// src/components/MaterialItemDebug.tsx
import React from "react";
import { Trash2, FileText, Link as LinkIcon } from "lucide-react";
import { deleteFirestoreItem } from "@/utils/deleteItem"; // update path if needed

export default function MaterialItemDebug({ classroomId, m, canUserManage, user }: any) {
  // quick defensive logs
  console.log("🔷 Render MaterialItemDebug", { id: m?.id, name: m?.name, uploaderId: m?.uploaderId });

  // click handler
  async function onDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("🟢 Delete button clicked (debug)", { id: m?.id });

    if (!m?.id) {
      alert("Item missing id; cannot delete.");
      return;
    }

    const ok = window.confirm(`Delete "${m.name}" ? This cannot be undone.`);
    if (!ok) {
      console.log("🟡 User cancelled delete");
      return;
    }

    try {
      // show immediate feedback
      console.log("🔸 Calling delete util...");
      // Pass storagePath to the delete utility
      await deleteFirestoreItem(classroomId, "materials", m.id, m.storagePath);
      alert("✅ Deleted successfully");
    } catch (err: any) {
      console.error("❌ Delete failed (debug):", err);
      alert("Delete failed: " + (err?.message || err));
    }
  }

  return (
    <div
      key={m.id}
      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
      style={{ position: "relative" }} // safe position
    >
      {/* LEFT: link content (make sure link does not wrap the delete button) */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flexGrow: 1 }}>
        <a
          href={m.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => { /* allow link normal behavior */ }}
          style={{ textDecoration: "none", color: "inherit", flexGrow: 1 }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {m.type === "link" ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {m.name}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#9AA0A6", marginTop: 6 }}>
              Shared by {m.uploaderName} on{" "}
              {m.uploadedAt?.toDate ? new Date(m.uploadedAt.toDate()).toLocaleString() : (new Date(m.uploadedAt || Date.now()).toLocaleString())}
            </div>
          </div>
        </a>
      </div>

      {/* RIGHT: delete button (completely outside the <a>) */}
      {(canUserManage || user?.uid === m.uploaderId) && (
        <button
          onClick={onDeleteClick}
          style={{
            height: 36,
            width: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 18,
            marginLeft: 12,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            zIndex: 9999,            // bring it above neighbors
            pointerEvents: "auto",   // ensure pointer events are enabled
          }}
          aria-label={`Delete ${m.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
