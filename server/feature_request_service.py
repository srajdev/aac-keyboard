"""Feature Request Service — manages Claude Code CLI sessions for in-app feature requests."""

import asyncio
import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

SESSION_FILE = Path(__file__).parent / "feature_request_session.json"
HISTORY_FILE = Path(__file__).parent / "feature_request_history.json"
REPO_ROOT = Path(__file__).parent.parent

INITIAL_PROMPT_TEMPLATE = """\
You are implementing feature requests for the Viraj Keyboard assistive communication app.
Follow the rules in CLAUDE.md (already in this repo). The requester is Viraj's dad — non-technical.

Your workflow:
1. Ask up to 3 clarifying questions. DO NOT make any changes yet.
2. Present a clear plan. Ask "Ready to implement?"
3. After approval: git checkout -b feature/{{slug}}, implement changes, commit.
   End your response with exactly: [BRANCH: feature/{{slug}}]
4. Tell dad to refresh the page to see the changes.

Feature request: "{message}"
"""


@dataclass
class FeatureRequestSession:
    claude_session_id: Optional[str] = None
    phase: str = "gather"  # gather | plan | implement | review | done
    branch_name: Optional[str] = None
    base_branch: str = "main"  # branch to merge into / revert to
    initial_request: str = ""  # first message from the user (used as history title)


@dataclass
class HistoryEntry:
    id: str
    title: str
    branch: Optional[str]
    base_branch: str
    status: str  # "merged" | "reverted" | "cancelled"
    timestamp: str
    merge_commit: Optional[str] = None  # commit hash of the squash merge commit


# ── Session persistence ────────────────────────────────────────────────────────

def load_session() -> FeatureRequestSession:
    """Load session state from disk (survives uvicorn auto-reloads)."""
    if SESSION_FILE.exists():
        try:
            data = json.loads(SESSION_FILE.read_text())
            return FeatureRequestSession(**data)
        except Exception:
            pass
    return FeatureRequestSession()


def save_session(session: FeatureRequestSession) -> None:
    """Persist session state to disk."""
    SESSION_FILE.write_text(json.dumps(asdict(session), indent=2))


def clear_session() -> None:
    """Remove persisted session file."""
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()


# ── History persistence ────────────────────────────────────────────────────────

def load_history() -> list[dict]:
    """Load all history entries (newest first)."""
    if HISTORY_FILE.exists():
        try:
            entries = json.loads(HISTORY_FILE.read_text())
            return list(reversed(entries))
        except Exception:
            pass
    return []


def append_history(session: FeatureRequestSession, status: str, merge_commit: Optional[str] = None) -> dict:
    """Append a completed session to the history log. Returns the new entry."""
    entry = HistoryEntry(
        id=str(uuid.uuid4()),
        title=session.initial_request[:80] or "(no description)",
        branch=session.branch_name,
        base_branch=session.base_branch,
        status=status,
        timestamp=datetime.now().isoformat(timespec="seconds"),
        merge_commit=merge_commit,
    )
    entries: list = []
    if HISTORY_FILE.exists():
        try:
            entries = json.loads(HISTORY_FILE.read_text())
        except Exception:
            pass
    entries.append(asdict(entry))
    HISTORY_FILE.write_text(json.dumps(entries, indent=2))
    return asdict(entry)


# ── Helpers ────────────────────────────────────────────────────────────────────

def detect_branch_from_output(text: str) -> Optional[str]:
    """Parse [BRANCH: feature/...] tag from Claude's output."""
    match = re.search(r"\[BRANCH:\s*([\w/\-]+)\]", text)
    if match:
        return match.group(1).strip()
    return None


async def run_claude(args: list[str], cwd: Path = REPO_ROOT) -> dict:
    """
    Run the Claude Code CLI non-interactively and return parsed JSON output.
    Returns dict with keys: session_id, text, raw
    """
    cmd = [
        "claude",
        "--output-format", "json",
        "--dangerously-skip-permissions",
        "-p",
    ] + args

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)

    raw = stdout.decode("utf-8", errors="replace")
    if stderr:
        err = stderr.decode("utf-8", errors="replace")
        print(f"[FeatureRequest] claude stderr: {err[:500]}")

    try:
        data = json.loads(raw)
        session_id = data.get("session_id", "")
        text = data.get("result", "") or data.get("response", "") or str(data)
        return {"session_id": session_id, "text": text, "raw": raw}
    except json.JSONDecodeError:
        return {"session_id": "", "text": raw, "raw": raw}


async def _current_branch() -> str:
    """Return the currently checked-out git branch name."""
    proc = await asyncio.create_subprocess_exec(
        "git", "rev-parse", "--abbrev-ref", "HEAD",
        cwd=str(REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return stdout.decode().strip() or "main"


# ── Session lifecycle ──────────────────────────────────────────────────────────

async def start_session(message: str) -> tuple[FeatureRequestSession, str]:
    """Start a new Claude Code session. Returns (session, response_text)."""
    base = await _current_branch()
    prompt = INITIAL_PROMPT_TEMPLATE.format(message=message)
    result = await run_claude([prompt])

    session = FeatureRequestSession(
        claude_session_id=result["session_id"],
        phase="gather",
        base_branch=base,
        initial_request=message,
    )
    save_session(session)
    return session, result["text"]


async def continue_session(session: FeatureRequestSession, message: str) -> tuple[FeatureRequestSession, str]:
    """Continue an existing Claude Code session. Returns (updated_session, response_text)."""
    if not session.claude_session_id:
        raise ValueError("No active session to continue")

    result = await run_claude([
        "--resume", session.claude_session_id,
        message,
    ])

    text = result["text"]

    if result["session_id"]:
        session.claude_session_id = result["session_id"]

    branch = detect_branch_from_output(text)
    if branch:
        session.branch_name = branch
        session.phase = "review"

    save_session(session)
    return session, text


# ── Git operations ─────────────────────────────────────────────────────────────

async def _git(*args: str) -> tuple[int, str, str]:
    """Run a git command, return (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        cwd=str(REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode().strip(), stderr.decode().strip()


async def merge_branch(session: FeatureRequestSession) -> str:
    """Squash-merge feature branch into base branch. Returns the merge commit hash."""
    if not session.branch_name:
        raise ValueError("No branch to merge")

    await _git("checkout", session.base_branch)

    rc, _, err = await _git("merge", "--squash", session.branch_name)
    if rc != 0:
        raise RuntimeError(f"git merge --squash failed: {err}")

    title = (session.initial_request[:72] or session.branch_name)
    rc, _, err = await _git("commit", "-m", f"feat: {title}")
    if rc != 0:
        raise RuntimeError(f"git commit failed: {err}")

    _, commit_hash, _ = await _git("rev-parse", "HEAD")
    return commit_hash


async def discard_branch(session: FeatureRequestSession) -> None:
    """Discard feature branch and return to the base branch."""
    await _git("checkout", session.base_branch)
    if session.branch_name:
        await _git("branch", "-D", session.branch_name)


async def revert_history_entry(entry_id: str) -> dict:
    """
    Revert a previously merged entry by its history ID.
    Runs `git revert <commit> --no-edit` and updates the entry status.
    Returns the updated entry dict.
    """
    if not HISTORY_FILE.exists():
        raise ValueError("No history found")

    entries = json.loads(HISTORY_FILE.read_text())
    entry = next((e for e in entries if e["id"] == entry_id), None)
    if not entry:
        raise ValueError(f"History entry {entry_id!r} not found")
    if entry["status"] != "merged":
        raise ValueError("Only merged entries can be reverted")
    if not entry.get("merge_commit"):
        raise ValueError("No commit hash stored for this entry — cannot revert")

    # Make sure we're on the right branch
    await _git("checkout", entry["base_branch"])

    rc, _, err = await _git("revert", entry["merge_commit"], "--no-edit")
    if rc != 0:
        raise RuntimeError(f"git revert failed: {err}")

    entry["status"] = "reverted"
    HISTORY_FILE.write_text(json.dumps(entries, indent=2))
    return entry
