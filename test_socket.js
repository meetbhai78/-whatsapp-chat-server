const io = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected with id:", socket.id);
    
    // Join a room
    socket.emit("join", "123");
    
    // Send a message
    socket.emit("sendMessage", {
        senderId: "456",
        receiverId: "123",
        message: "Hello from test script",
        messageId: "test-id-" + Date.now(),
        timestamp: Date.now(),
        isGhost: false
    });
    
    console.log("Message emitted!");
});

socket.on("receiveMessage", (data) => {
    console.log("SUCCESS! Received message:", data);
    process.exit(0);
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});

setTimeout(() => {
    console.log("Timeout! Did not receive receiveMessage event after 10 seconds.");
    process.exit(1);
}, 10000);
