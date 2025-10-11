'use client';
import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Assignments({ classroomId, teacherId }: { classroomId: string; teacherId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  const user = auth.currentUser;

  const handlePost = async () => {
    if (!title) return alert("Title required");
    try {
      await addDoc(collection(db, "classrooms", classroomId, "assignments"), {
        title,
        description,
        deadline,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      });
      setTitle("");
      setDescription("");
      setDeadline("");
      setShowForm(false);
      alert("Assignment posted!");
    } catch (err) {
      console.error("Error posting assignment:", err);
      alert("Failed to post assignment");
    }
  };

  return (
    <div className="p-4">
      {/* Show Post Button only for teacher */}
      {user?.uid === teacherId && (
        <div className="mb-4">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)}>+ Post Assignment</Button>
          ) : (
            <div className="space-y-2 bg-gray-800 p-4 rounded-xl">
              <Input
                placeholder="Assignment title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Assignment description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handlePost}>Post</Button>
                <Button variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List assignments */}
      <div>
        <p className="text-gray-400">Assignments will show here...</p>
      </div>
    </div>
  );
}
