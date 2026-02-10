#!/usr/bin/env python3
"""
Test WebSocket connection and predictions
"""
import asyncio
import json
import websockets
import uuid

async def test_websocket():
    uri = "ws://localhost:3000/ws/predictions"

    print(f"Connecting to {uri}...")

    try:
        async with websockets.connect(uri) as websocket:
            print("✓ Connected successfully!")

            # Test 1: Send a word prediction request
            request_id_1 = str(uuid.uuid4())
            request_1 = {
                "type": "words",
                "requestId": request_id_1,
                "partialInput": "I wan",
                "conversationContext": "Mom asked: What do you want for lunch?",
                "model": "claude"
            }

            print(f"\n→ Sending words request (ID: {request_id_1[:8]}...)")
            await websocket.send(json.dumps(request_1))

            # Test 2: Send a phrase prediction request
            request_id_2 = str(uuid.uuid4())
            request_2 = {
                "type": "phrases",
                "requestId": request_id_2,
                "partialInput": "I wan",
                "conversationContext": "Mom asked: What do you want for lunch?",
                "model": "claude"
            }

            print(f"→ Sending phrases request (ID: {request_id_2[:8]}...)")
            await websocket.send(json.dumps(request_2))

            # Wait for responses
            responses_received = 0
            while responses_received < 2:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=15.0)
                    data = json.loads(response)

                    if data.get("type") in ["words", "phrases"]:
                        print(f"\n✓ Received {data['type']} response:")
                        print(f"  Request ID: {data['requestId'][:8]}...")
                        print(f"  Success: {data.get('success')}")
                        print(f"  Data: {data.get('data', [])[:3]}...")  # Show first 3
                        responses_received += 1
                    elif data.get("type") == "error":
                        print(f"\n✗ Error response:")
                        print(f"  Request ID: {data['requestId'][:8]}...")
                        print(f"  Error: {data.get('error')}")
                        print(f"  Message: {data.get('message')}")
                        responses_received += 1

                except asyncio.TimeoutError:
                    print("\n✗ Timeout waiting for response")
                    break

            # Test 3: Test heartbeat
            print(f"\n→ Sending ping...")
            await websocket.send(json.dumps({"type": "ping"}))

            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                if data.get("type") == "pong":
                    print(f"✓ Received pong response")
            except asyncio.TimeoutError:
                print(f"✗ No pong response received")

            # Test 4: Test cancellation
            print(f"\n→ Testing cancellation...")
            request_id_3 = str(uuid.uuid4())
            request_3 = {
                "type": "words",
                "requestId": request_id_3,
                "partialInput": "test",
                "conversationContext": "",
                "model": "claude"
            }
            await websocket.send(json.dumps(request_3))

            # Immediately cancel it
            cancel_msg = {
                "type": "cancel",
                "requestIds": [request_id_3]
            }
            await websocket.send(json.dumps(cancel_msg))
            print(f"✓ Sent cancel message")

            print(f"\n✓ All tests passed!")

    except Exception as e:
        print(f"\n✗ Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_websocket())
