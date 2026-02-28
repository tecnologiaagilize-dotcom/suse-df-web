import os
import socketio
from aiohttp import web
from supabase import create_client, Client
import json
import asyncio

# Configuração
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Servidor Socket.IO (WebRTC Signaling)
sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)

# Estado em Memória (Simplificado para MVP)
# Em produção, usar Redis
rooms = {} 

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def join_room(sid, data):
    """
    Passageiro entra na sala (room = occurrence_id)
    """
    occurrence_id = data.get('occurrence_id')
    token = data.get('session_token')
    
    # Validar token no Supabase
    # ...
    
    sio.enter_room(sid, occurrence_id)
    print(f"Client {sid} joined room {occurrence_id}")
    await sio.emit('room_joined', {'room': occurrence_id}, room=sid)

@sio.event
async def offer(sid, data):
    """
    Encaminha oferta WebRTC para a central (ou SFU)
    """
    room = data.get('room')
    await sio.emit('offer', data, room=room, skip_sid=sid)

@sio.event
async def answer(sid, data):
    """
    Encaminha resposta WebRTC
    """
    room = data.get('room')
    await sio.emit('answer', data, room=room, skip_sid=sid)

@sio.event
async def candidate(sid, data):
    """
    Troca de candidatos ICE
    """
    room = data.get('room')
    await sio.emit('candidate', data, room=room, skip_sid=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

# Health Check
async def health_check(request):
    return web.Response(text="Signaling Server OK")

app.router.add_get('/', health_check)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    web.run_app(app, port=port)
