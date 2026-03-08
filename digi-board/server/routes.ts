import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertAnnouncementSchema, insertAssignmentSchema, insertMaterialSchema, insertEventSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword } from "./auth";
import { upload, getFileUrl } from "./file-upload";
import path from "path";
import fs from "fs";
import express from "express";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Serve static files from fileuploads directory
  app.use('/fileuploads', express.static(path.join(__dirname, 'fileuploads')));

  // Announcements routes
  app.get("/api/announcements", async (req, res, next) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/announcements", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      // Only teachers and admins can create announcements
      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      const validatedData = insertAnnouncementSchema.parse({
        ...req.body,
        authorId: user.id,
      });

      const announcement = await storage.createAnnouncement(validatedData);
      res.status(201).json(announcement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      next(error);
    }
  });

  app.get("/api/announcements/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const announcement = await storage.getAnnouncement(id);

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      res.json(announcement);
    } catch (error) {
      next(error);
    }
  });

  // Assignments routes
  app.get("/api/assignments", async (req, res, next) => {
    try {
      const assignments = await storage.getAllAssignments();
      res.json(assignments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/assignments", upload.single("file"), async (req, res, next) => {
    try {
      console.log("[DEBUG] /api/assignments route hit:");
      console.log(" - req.file:", req.file);

      // Check authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = req.user as Express.User;

      // Check user role
      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      let attachmentUrl = undefined;
      if (req.file) {
        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, "fileuploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        attachmentUrl = `/fileuploads/${req.file.filename}`;
      }

      // Validate the request body
      const validatedData = insertAssignmentSchema.parse({
        ...req.body,
        teacherId: user.id,
        status: req.body.status || "active",
        attachmentUrl: attachmentUrl, // Include the file URL if it was uploaded
        weightage: req.body.weightage ? parseInt(req.body.weightage) : undefined,
        priority: req.body.priority || undefined,
      });

      // Create the assignment
      const assignment = await storage.createAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid assignment data",
          errors: error.errors
        });
      }
      next(error);
    }
  });

  app.get("/api/assignments/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json(assignment);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/assignments/teacher/:teacherId", async (req, res, next) => {
    try {
      const teacherId = parseInt(req.params.teacherId);
      const assignments = await storage.getAssignmentsByTeacher(teacherId);
      res.json(assignments);
    } catch (error) {
      next(error);
    }
  });

  // Materials routes
  app.get("/api/materials", async (req, res, next) => {
    try {
      const materials = await storage.getAllMaterials();
      res.json(materials);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/materials", upload.single("file"), async (req, res) => {
    try {
      console.log("Received material creation request");
      console.log("Request body:", req.body);
      console.log("Request file:", req.file);
      console.log("Request user:", req.user);

      // Check authentication
      if (!req.user) {
        console.log("Authentication check failed");
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check role authorization
      if (req.user.role !== "teacher" && req.user.role !== "admin") {
        console.log("Role check failed:", req.user.role);
        return res.status(403).json({ error: "Only teachers and admins can create materials" });
      }

      // Check for file upload
      if (!req.file) {
        console.log("No file uploaded");
        return res.status(400).json({ error: "Please upload a file" });
      }

      console.log("File uploaded successfully:", {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Ensure uploads directory exists
      const uploadsDir = path.join(__dirname, "fileuploads");
      if (!fs.existsSync(uploadsDir)) {
        console.log("Creating fileuploads directory");
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Construct material data
      const materialData = {
        title: req.body.title,
        description: req.body.description,
        fileUrl: `/fileuploads/${req.file.filename}`,
        teacherId: req.user.id,
        classId: req.body.classId || undefined,
        category: req.body.category || undefined,
      };

      console.log("Constructed material data:", materialData);

      try {
        // Validate material data
        const validatedData = insertMaterialSchema.parse(materialData);
        console.log("Data validation successful");

        // Create material in database
        const material = await storage.createMaterial(validatedData);
        console.log("Material created successfully:", material);

        res.status(201).json(material);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        // If validation fails, delete the uploaded file
        if (req.file) {
          const filePath = path.join(__dirname, req.file.path);
          console.log("Attempting to delete file at:", filePath);
          if (fs.existsSync(filePath)) {
            console.log("Deleting uploaded file due to validation error");
            try {
              fs.unlinkSync(filePath);
              console.log("File deleted successfully");
            } catch (deleteError) {
              console.error("Error deleting file:", deleteError);
            }
          } else {
            console.log("File does not exist at path:", filePath);
          }
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error creating material:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid data",
          details: error.errors,
          message: error.errors.map(e => e.message).join(", ")
        });
      }
      res.status(500).json({
        error: "Failed to create material",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  app.get("/api/materials/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const material = await storage.getMaterial(id);

      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }

      res.json(material);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/materials/teacher/:teacherId", async (req, res, next) => {
    try {
      const teacherId = parseInt(req.params.teacherId);
      const materials = await storage.getMaterialsByTeacher(teacherId);
      res.json(materials);
    } catch (error) {
      next(error);
    }
  });

  // Delete routes
  app.delete("/api/announcements/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      // Only teachers and admins can delete announcements
      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteAnnouncement(id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (req.user.role !== "teacher" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only teachers and admins can delete assignments" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid assignment ID" });
      }

      // Check if the assignment exists and belongs to the user
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      if (assignment.teacherId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "You can only delete your own assignments" });
      }

      await storage.deleteAssignment(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  app.delete("/api/materials/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (req.user.role !== "teacher" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only teachers and admins can delete materials" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid material ID" });
      }

      const success = await storage.deleteMaterial(id);
      if (!success) {
        return res.status(404).json({ error: "Material not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ error: "Failed to delete material" });
    }
  });

  // Events routes
  app.get("/api/events", async (req, res, next) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/events", async (req, res, next) => {
    try {
      console.log('Received event creation request:', req.body);

      if (!req.isAuthenticated()) {
        console.log('Authentication check failed');
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = req.user as Express.User;
      console.log('User role:', user.role);

      // Only teachers and admins can create events
      if (user.role !== "teacher" && user.role !== "admin") {
        console.log('Role check failed:', user.role);
        return res.status(403).json({ message: "Unauthorized role" });
      }

      // Parse and validate dates
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      if (endDate < startDate) {
        return res.status(400).json({ message: "End date must be after start date" });
      }

      // Validate and transform the data
      const validatedData = insertEventSchema.parse({
        ...req.body,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdBy: user.id,
      });

      console.log('Validated event data:', validatedData);

      // Create the event
      const event = await storage.createEvent(validatedData);
      console.log('Created event:', event);

      // Send response
      res.status(201).json(event);
    } catch (error) {
      console.error('Event creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid data",
          errors: error.errors,
          details: error.issues
        });
      }
      res.status(500).json({
        error: "Failed to create event",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.get("/api/events/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  // User management routes (admin only)
  app.get("/api/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      // Only admins can list all users
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      const users = await storage.getAllUsers();
      // Remove passwords before sending
      const sanitizedUsers = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
      res.json(sanitizedUsers);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const currentUser = req.user as Express.User;

      // Only admins can create users
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      // Validate the new user data
      const validatedData = insertUserSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create the user
      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      next(error);
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const currentUser = req.user as Express.User;

      // Only admins can delete users
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      const userId = parseInt(req.params.id);

      // Prevent deleting your own account
      if (userId === currentUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const result = await storage.deleteUser(userId);

      if (!result) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Update user (admin only)
  app.patch("/api/users/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const currentUser = req.user as Express.User;

      // Only admins can update users
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized role" });
      }

      const userId = parseInt(req.params.id);
      const userData = req.body;

      // If password is being updated, hash it
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }

      const updatedUser = await storage.updateUser(userId, userData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      res.status(200).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      next(error);
    }
  });

  // --- AI Proctor Integration Routes ---

  app.post("/api/study-sessions/start", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      const sessionData = {
        userId: user.id,
        assignmentId: req.body.assignmentId || null,
        startedAt: new Date(),
      };

      const studySession = await storage.createStudySession(sessionData);
      res.status(201).json(studySession);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/study-sessions/:id/telemetry", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) return res.status(400).json({ error: "Invalid session ID" });

      const telemetryData = {
        sessionId,
        focusScore: req.body.focusScore,
        stressScore: req.body.stressScore,
        distractedScore: req.body.distractedScore,
        stateClassification: req.body.stateClassification,
        recordedAt: new Date()
      };

      const telemetry = await storage.addSessionTelemetry(telemetryData);
      res.status(201).json(telemetry);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/study-sessions/:id/end", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) return res.status(400).json({ error: "Invalid session ID" });

      const updateData = {
        endedAt: new Date(),
        avgFocusScore: req.body.avgFocusScore,
        avgStressScore: req.body.avgStressScore,
        avgDistractedScore: req.body.avgDistractedScore || 0
      };

      const studySession = await storage.updateStudySession(sessionId, updateData);
      res.status(200).json(studySession);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/study-sessions/student", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      // We will need a storage method for this, so just mapping to it now
      if (typeof (storage as any).getStudySessionsByUser === 'function') {
        const sessions = await (storage as any).getStudySessionsByUser(user.id);
        res.json(sessions);
      } else {
        res.status(501).json({ error: "Method not implemented in storage yet" });
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/study-sessions/all", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized role" });
      }

      if (typeof (storage as any).getAllStudySessions === 'function') {
        const sessions = await (storage as any).getAllStudySessions();
        res.json(sessions);
      } else {
        res.status(501).json({ error: "Method not implemented in storage yet" });
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/recommended-workload", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const user = req.user as Express.User;

      // 1. Calculate 48-hour window
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

      // 2. Fetch recent study sessions
      let recentSessions: any[] = [];
      if (typeof (storage as any).getRecentStudySessionsByUser === 'function') {
        recentSessions = await (storage as any).getRecentStudySessionsByUser(user.id, fortyEightHoursAgo);
      }

      // 3. Calculate 2-Day Avg Stress
      let avgStress = 0;
      if (recentSessions.length > 0) {
        // sessions store avgStressScore as an integer (e.g., 85 instead of 0.85)
        const totalStress = recentSessions.reduce((acc, sum) => acc + (sum.avgStressScore || 0), 0);
        const avgScore = totalStress / recentSessions.length;
        avgStress = avgScore / 100; // normalize back to 0.0 - 1.0
      }

      // 4. Calculate Capacity
      // Capacity = 100 - (Avg_2Day_Stress * 75)
      let capacity = 100 - Math.round(avgStress * 75);
      // Ensure capacity stays within 0-100 range
      capacity = Math.max(0, Math.min(100, capacity));

      // Determine modes
      let mode = "Normal Mode";
      let trend = "Stable";
      if (avgStress > 0.6) {
        mode = "Immediate Recovery Mode";
        trend = "Trending Up"; // Stress trending up
      } else if (avgStress < 0.3 && recentSessions.length > 0) { // Require at least one session to be 'Peak'
        mode = "Peak Performance";
        trend = "Trending Down"; // Stress trending down
      }

      // 5. Fetch user's assignments
      let allAssignments = await storage.getAllAssignments();
      // Students should only see active assignments, we map over them
      // Note: Ideally query by classId, but keeping it simple based on existing structure
      let tasks = allAssignments.filter(a => new Date(a.dueDate) > new Date());

      // 6. Apply Workload Engine Logic
      let recommendedTasks = [...tasks];

      if (mode === "Immediate Recovery Mode") {
        // Hide Weight 3 tasks and High priority items
        recommendedTasks = tasks.filter(t => t.weightage !== 3 && t.priority?.toLowerCase() !== 'high');
        // Sort to prioritize Weight 1 tasks first
        recommendedTasks.sort((a, b) => {
          if (a.weightage === 1 && b.weightage !== 1) return -1;
          if (a.weightage !== 1 && b.weightage === 1) return 1;
          return 0; // fallback to natural order
        });
      } else if (mode === "Peak Performance") {
        // Prioritize Weight 3 and High Priority
        recommendedTasks.sort((a, b) => {
          let scoreA = (a.weightage === 3 ? 2 : 0) + (a.priority?.toLowerCase() === 'high' ? 2 : 0);
          let scoreB = (b.weightage === 3 ? 2 : 0) + (b.priority?.toLowerCase() === 'high' ? 2 : 0);
          return scoreB - scoreA;
        });
      } else {
        // Normal Mode: Order by Due Date
        recommendedTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      }

      // Return top 5 maximum to not overwhelm
      recommendedTasks = recommendedTasks.slice(0, 5);

      res.json({
        mode,
        capacity,
        trend,
        recentSessionsCount: recentSessions.length,
        avgStress,
        recommendedTasks
      });

    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
