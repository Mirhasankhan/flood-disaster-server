const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("floodDisaster");
    const usersCollection = db.collection("users");
    const campainCollection = db.collection("campain");
    const donationCollection = db.collection("donations");
    const testimonialsCollection = db.collection("testimonials");
    const volunteerCollection = db.collection("volunteer");
    const newsCollection = db.collection("news");

    // User Registration
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password, role } = req.body;

      // Check if email already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await usersCollection.insertOne({
        name,
        email,
        role,
        password: hashedPassword,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });

      res.json({
        success: true,
        message: "Login successful",
        email: req.body.email,
        token,
        role: user.role,
        name: user.name,
      });
    });

    app.get("/api/v1/users", async (req, res) => {
      let query = {};
      if (req.query?.role) {
        query = { role: req.query.role };
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/api/v1/users/:email/updateRole", async (req, res) => {
      try {
        const { email } = req.params;
        const { role } = req.body;
        const filter = { email: email };
        const update = { $set: { role } };

        const result = await usersCollection.updateOne(filter, update);

        if (result.modifiedCount === 0)
          return res.status(404).json({ error: "User not found" });

        res.json({ message: "User role updated successfully" });
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/api/v1/addCampain", async (req, res) => {
      const body = req.body;
      await campainCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "campain posted successfully",
      });
    });

    app.get("/api/v1/campains", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await campainCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/api/v1/campains/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await campainCollection.find(filter).toArray();
      res.send(result);
    });

    app.put("/api/v1/campains/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { newAmount } = req.body;

        if (!ObjectId.isValid(id))
          return res.status(400).json({ error: "Invalid ID format" });
        if (typeof newAmount !== "number" || newAmount <= 0)
          return res.status(400).json({ error: "Invalid newAmount value" });

        const filter = { _id: new ObjectId(id) };

        // Find the current collectedAmount
        const campain = await campainCollection.findOne(filter);
        if (!campain)
          return res.status(404).json({ error: "Campain not found" });

        const updatedAmount =
          (Number(campain.collectedAmount) || 0) + newAmount;

        const update = { $set: { collectedAmount: updatedAmount } };
        const result = await campainCollection.updateOne(filter, update);

        if (result.modifiedCount === 0)
          return res
            .status(404)
            .json({ error: "Failed to update collectedAmount" });

        res.json({
          message: "Donation successful",
          collectedAmount: updatedAmount,
        });
      } catch (error) {
        console.error("Error updating campain collectedAmount:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.delete("/api/v1/campains/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = campainCollection.deleteOne(filter);
      res.send(result);
    });

    //donations api
    app.post("/api/v1/donate", async (req, res) => {
      const body = req.body;
      await donationCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "Donated successfully",
      });
    });

    app.get("/api/v1/leaderboard", async (req, res) => {
      try {
        const leaderboard = await donationCollection
          .aggregate([
            {
              $group: {
                _id: "$email",
                totalAmount: { $sum: "$amount" },
                name: { $first: "$name" },
              },
            },
            {
              $sort: { totalAmount: -1 },
            },
          ])
          .toArray();

        res.json({ leaderboard });
      } catch (error) {
        console.error("Error generating leaderboard:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/api/v1/donations", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    //donor testimonial
    app.get("/api/v1/testimonials", async (req, res) => {
      const result = await testimonialsCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/v1/createTestimonial", async (req, res) => {
      const body = req.body;
      await testimonialsCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "Testimonial Posted successfully",
      });
    });

    app.get("/api/v1/volunteers", async (req, res) => {
      const result = await volunteerCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/v1/volunteer", async (req, res) => {
      const body = req.body;
      const email = body.email;
      const existing = await volunteerCollection.findOne({ email });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Volunteer already exists",
        });
      }

      await volunteerCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "Volunteer Added successfully",
      });
    });

    app.get("/api/v1/allNews", async (req, res) => {
      const result = await newsCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/v1/addNews", async (req, res) => {
      const body = req.body;
      await newsCollection.insertOne(body);
      res.status(201).json({
        success: true,
        message: "News Added successfully",
      });
    });

    app.post("/api/v1/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});
