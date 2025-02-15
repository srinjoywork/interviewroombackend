import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import ACTIONS from './Actions.js';

dotenv.config();

const app = express();
app.use(cors());
app.get('/', (req, res) => {
    res.send('server is working');
});
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust based on your frontend URL (e.g., "http://localhost:3000")
        methods: ["GET", "POST"],
    },
    pingTimeout: 60000, // Set pingTimeout to handle long connections
    pingInterval: 25000, // Set pingInterval to avoid socket disconnection due to inactivity
});

const PORT = process.env.PORT || 3000;

const userSocketMap = {}

function getAllConnectedClients(roomID) {
    return Array.from(io.sockets.adapter.rooms.get(roomID) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId]
        }
    })
}

io.on('connection', (socket) => {
    console.log("Socket connected: " + socket.id);

    // Error handling
    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });

    socket.on('disconnect', () => {
        console.log("Socket disconnected: " + socket.id);
    });

    // ACTIONS -- JOIN
    socket.on(ACTIONS.JOIN, ({ roomID, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomID);
        const clients = getAllConnectedClients(roomID);
        console.log("Clients in room:", clients);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id
            })
        });
    });

    // ACTIONS -- CODE CHANGE
    socket.on(ACTIONS.CODE_CHANGE, ({ roomID, code }) => {
        socket.in(roomID).emit(ACTIONS.CODE_CHANGE, { code })
    });

    // Sync code to individual user
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // ACTIONS -- DISCONNECTED
    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomID) => {
            socket.in(roomID).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            })
        });
        delete userSocketMap[socket.id];
        socket.leave();
    })
});

server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
