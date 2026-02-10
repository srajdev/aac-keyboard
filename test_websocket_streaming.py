#!/usr/bin/env python3
"""Test WebSocket streaming predictions."""

import asyncio
import websockets
import json
import time
from dotenv import load_dotenv

load_dotenv()

async def test_streaming():
    """Test WebSocket streaming with the server."""
    uri = "ws://localhost:3000/ws/predictions"

    async with websockets.connect(uri) as websocket:
        print("✓ Connected to WebSocket")

        # Test word predictions
        request_id = "test-words-123"
        request = {
            "type": "words",
            "requestId": request_id,
            "partialInput": "I want to",
            "conversationContext": "Someone asked what Viraj wants to eat",
            "model": "claude"
        }

        print(f"\n📤 Sending words request: {request_id}")
        await websocket.send(json.dumps(request))

        start_time = time.time()
        first_chunk_time = None
        chunks_received = 0

        # Listen for responses
        while True:
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                message = json.loads(response)
                elapsed_ms = (time.time() - start_time) * 1000

                if message.get("requestId") == request_id:
                    if message["type"] == "stream_chunk":
                        chunks_received += 1
                        if first_chunk_time is None:
                            first_chunk_time = elapsed_ms
                        print(f"  📊 Chunk {chunks_received} ({elapsed_ms:.0f}ms): {message['predictions']}")

                    elif message["type"] == "stream_complete":
                        print(f"\n✓ Stream complete ({elapsed_ms:.0f}ms)")
                        if first_chunk_time:
                            print(f"  First chunk: {first_chunk_time:.0f}ms")
                        else:
                            print(f"  No chunks received (all at once)")
                        print(f"  Total chunks: {chunks_received}")
                        print(f"  Final predictions: {message['predictions']}")
                        break

                    elif message["type"] == "stream_error":
                        print(f"\n✗ Stream error: {message['message']}")
                        if message.get('predictions'):
                            print(f"  Partial predictions: {message['predictions']}")
                        break

            except asyncio.TimeoutError:
                print("✗ Timeout waiting for response")
                break

        # Test phrase predictions
        print("\n" + "="*60)
        request_id = "test-phrases-456"
        request = {
            "type": "phrases",
            "requestId": request_id,
            "partialInput": "I would like",
            "conversationContext": "Someone asked if Viraj needs help",
            "model": "claude"
        }

        print(f"\n📤 Sending phrases request: {request_id}")
        await websocket.send(json.dumps(request))

        start_time = time.time()
        first_chunk_time = None
        chunks_received = 0

        # Listen for responses
        while True:
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                message = json.loads(response)
                elapsed_ms = (time.time() - start_time) * 1000

                if message.get("requestId") == request_id:
                    if message["type"] == "stream_chunk":
                        chunks_received += 1
                        if first_chunk_time is None:
                            first_chunk_time = elapsed_ms
                        print(f"  📊 Chunk {chunks_received} ({elapsed_ms:.0f}ms):")
                        for i, phrase in enumerate(message['predictions'], 1):
                            print(f"    {i}. {phrase}")

                    elif message["type"] == "stream_complete":
                        print(f"\n✓ Stream complete ({elapsed_ms:.0f}ms)")
                        if first_chunk_time:
                            print(f"  First chunk: {first_chunk_time:.0f}ms")
                        else:
                            print(f"  No chunks received (all at once)")
                        print(f"  Total chunks: {chunks_received}")
                        print(f"  Final predictions:")
                        for i, phrase in enumerate(message['predictions'], 1):
                            print(f"    {i}. {phrase}")
                        break

                    elif message["type"] == "stream_error":
                        print(f"\n✗ Stream error: {message['message']}")
                        if message.get('predictions'):
                            print(f"  Partial predictions: {message['predictions']}")
                        break

            except asyncio.TimeoutError:
                print("✗ Timeout waiting for response")
                break

if __name__ == "__main__":
    try:
        asyncio.run(test_streaming())
        print("\n✓ WebSocket streaming test completed successfully!")
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
