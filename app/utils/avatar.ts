
import { noteStorage, TransactionNote } from "./notes";

export const AVATAR_NOTE_ID = '_PROFILE_AVATAR_';

/**
 * Saves the avatar image as an encrypted note.
 * The image is resized and converted to Base64 before saving to ensure optimal performance.
 */
export async function saveAvatar(file: File, owner: string): Promise<string> {
    if (!owner) throw new Error("Owner required");

    // 1. Resize & Convert to Base64 (Max 400x400 to keep JSON size manageable)
    const base64 = await resizeImageToBase64(file, 400, 400);

    // 2. Save as a special TransactionNote
    // We treat the avatar as a special "note" so it gets encrypted/decrypted 
    // automatically with the user's session key alongside their other data.
    const avatarNote: TransactionNote = {
        signature: AVATAR_NOTE_ID,
        note: base64, // The actual image data
        timestamp: Date.now(),
        // Optional metadata
        token: 'UnikAvatar'
    };

    await noteStorage.saveNote(avatarNote, owner);

    return base64;
}

/**
 * Retrieves the decrypted avatar from the notes storage.
 */
export async function getAvatar(owner: string): Promise<string | null> {
    if (!owner) return null;
    try {
        const notes = await noteStorage.getNotes(owner);
        const avatarNote = notes[AVATAR_NOTE_ID];

        if (avatarNote && avatarNote.note && avatarNote.note.startsWith('data:image')) {
            return avatarNote.note;
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch avatar:", e);
        return null;
    }
}

export async function removeAvatar(owner: string): Promise<void> {
    if (!owner) return;
    await noteStorage.removeNote(AVATAR_NOTE_ID, owner);
}

/**
 * Helper to resize image and return Base64 string
 */
function resizeImageToBase64(file: File, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.8 quality to save space
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}
