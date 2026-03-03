"""Feature Request Service — manages Claude Code CLI sessions for in-app feature requests."""

import asyncio
import json
import re
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

SESSION_FILE = Path(__file__).parent / "feature_request_session.json"
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

    # Parse the JSON envelope
    try:
        data = json.loads(raw)
        session_id = data.get("session_id", "")
        # The result field contains the text response
        text = data.get("result", "") or data.get("response", "") or str(data)
        return {"session_id": session_id, "text": text, "raw": raw}
    except json.JSONDecodeError:
        # Fallback: treat entire stdout as text
        return {"session_id": "", "text": raw, "raw": raw}


async def start_session(message: str) -> tuple[FeatureRequestSession, str]:
    """
    Start a new Claude Code session with the initial feature request.
    Returns (session, response_text).
    """
    prompt = INITIAL_PROMPT_TEMPLATE.format(message=message)
    result = await run_claude([prompt])

    session = FeatureRequestSession(
        claude_session_id=result["session_id"],
        phase="gather",
    )
    save_session(session)
    return session, result["text"]


async def continue_session(session: FeatureRequestSession, message: str) -> tuple[FeatureRequestSession, str]:
    """
    Continue an existing Claude Code session with a follow-up message.
    Returns (updated_session, response_text).
    """
    if not session.claude_session_id:
        raise ValueError("No active session to continue")

    result = await run_claude([
        "--resume", session.claude_session_id,
        message,
    ])

    text = result["text"]

    # Update session ID in case it changed (though it shouldn't with --resume)
    if result["session_id"]:
        session.claude_session_id = result["session_id"]

    # Detect phase transitions from Claude's output
    branch = detect_branch_from_output(text)
    if branch:
        session.branch_name = branch
        session.phase = "review"

    save_session(session)
    return session, text


async def merge_branch(session: FeatureRequestSession) -> None:
    """Merge feature branch into main."""
    if not session.branch_name:
        raise ValueError("No branch to merge")

    proc = await asyncio.create_subprocess_exec(
        "git", "checkout", "main",
        cwd=str(REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.wait()

    proc = await asyncio.create_subprocess_exec(
        "git", "merge", "--no-ff", session.branch_name,
        cwd=str(REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.wait()


async def discard_branch(session: FeatureRequestSession) -> None:
    """Discard feature branch and return to main."""
    branch = session.branch_name

    proc = await asyncio.create_subprocess_exec(
        "git", "checkout", "main",
        cwd=str(REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.wait()

    if branch:
        proc = await asyncio.create_subprocess_exec(
            "git", "branch", "-D", branch,
            cwd=str(REPO_ROOT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.wait()
