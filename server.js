const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Connect to MongoDB Atlas (Cloud)
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_clone_db';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB Atlas (Cloud) successfully!");
    // Drop the old messageId index that causes Duplicate Key Error
    Message.collection.dropIndex('messageId_1').catch(err => console.log("Old index not found or already dropped"));
}).catch(err => {
    console.log("MongoDB Connection Error:", err);
});


// --- REST APIs --- //

// 1. Login / Register
app.post('/api/auth/login', async (req, res) => {
    const { phoneNumber } = req.body;
    if(!phoneNumber) return res.status(400).json({ error: "Phone number required" });
    
    try {
        let user = await User.findOne({ phoneNumber });
        if (!user) {
            // Create new user, we use phone number as UID
            user = new User({ uid: phoneNumber, phoneNumber });
            await user.save();
        }
        res.json({ message: "Login successful", user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Setup Profile (Update Name & Image)
app.post('/api/auth/setup', upload.single('profileImage'), async (req, res) => {
    const { uid, name } = req.body;
    try {
        let user = await User.findOne({ uid });
        if(!user) return res.status(404).json({ error: "User not found" });

        user.name = name;
        if(req.file) {
            // Get URL for the image
            const serverUrl = req.protocol + '://' + req.get('host');
            user.profileImage = serverUrl + '/uploads/' + req.file.filename;
        }
        await user.save();
        res.json({ message: "Profile updated successfully", user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get All Users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get Chat History
app.get('/api/messages/:senderId/:receiverId', async (req, res) => {
    try {
        const { senderId, receiverId } = req.params;
        const messages = await Message.find({
            $or: [
                { senderId: senderId, receiverId: receiverId },
                { senderId: receiverId, receiverId: senderId }
            ],
            isGhost: { $ne: true } // DO NOT send Ghost messages to the user!
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Delete Message
app.delete('/api/messages/:id', async (req, res) => {
    try {
        await Message.findByIdAndDelete(req.params.id);
        res.json({ message: 'Message deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Socket.io for Real-time Chat --- //
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a room based on UID to receive direct messages
    socket.on('join', (uid) => {
        socket.join(uid);
        console.log(`User ${uid} joined room`);
    });

    // Handle sending a message
    socket.on('sendMessage', async (data) => {
        // data should contain: senderId, receiverId, message, timestamp, isGhost
        const { senderId, receiverId, message, timestamp, isGhost } = data;
        
        try {
            // Save to MongoDB
            const newMessage = new Message({
                senderId,
                receiverId,
                message,
                timestamp: timestamp || Date.now(),
                isGhost: isGhost || false
            });
            const savedMessage = await newMessage.save();
            
            // Add MongoDB _id to data so it can be deleted later
            data._id = savedMessage._id;

            // Emit to the receiver's room
            io.to(receiverId).emit('receiveMessage', data);
            console.log('Message saved and sent to', receiverId);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    // Handle Buzz / Shake Phone
    socket.on('buzz', (data) => {
        // data should contain: senderId, receiverId
        io.to(data.receiverId).emit('receiveBuzz', data);
    });

    // Handle Ghost Mode Toggle
    socket.on('toggleGhostMode', (data) => {
        io.to(data.receiverId).emit('receiveGhostMode', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
