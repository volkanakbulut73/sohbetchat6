# PocketBase Schema Definition

To make the app function correctly with the provided code, configure your PocketBase collections as follows.

## 1. Collection: `users` (System)
*   **System Fields:** `id`, `username`, `email`, `emailVisibility`, `verified`, `created`, `updated`
*   **Custom Fields:**
    *   `avatar`: `file` (Max 1 file, MIME: image/*)
    *   `role`: `select` (Options: `admin`, `operator`, `user`, `bot`. Default: `user`)
    *   `isOnline`: `bool`
    *   `banned`: `bool`

## 2. Collection: `rooms`
*   **Fields:**
    *   `name`: `text` (Required)
    *   `topic`: `text`
    *   `isMuted`: `bool` (Default: false)

## 3. Collection: `messages`
*   **Fields:**
    *   `text`: `text` (Required)
    *   `user`: `relation` (Single, Collection: `users`, Cascade Delete: false)
    *   `room`: `relation` (Single, Collection: `rooms`, Cascade Delete: true)
    *   `type`: `select` (Options: `text`, `action`, `image`, `audio`. Default: `text`)
    *   `attachment`: `file` (MIME: image/*, audio/*)

## 4. Collection: `private_messages`
*   **Fields:**
    *   `text`: `text`
    *   `sender`: `relation` (Single, Collection: `users`)
    *   `recipient`: `relation` (Single, Collection: `users`)
    *   `attachment`: `file`
    *   `read`: `bool`

## 5. Collection: `room_music` (Optional)
*   **Fields:**
    *   `title`: `text`
    *   `url`: `url`
    *   `addedBy`: `relation` (Collection: `users`)
    *   `isPlaying`: `bool`

### API Rules (Permissions)
**CRITICAL:** You must set these rules in PocketBase Admin UI (> Collections > Settings > API Rules) or the app will not work correctly.

1.  **users**: 
    *   List/View: Empty (Public)
    *   Create: Empty (Public - for registration)
    *   Update: `id = @request.auth.id` (Allows users to update their own online status/avatar)

2.  **rooms**: 
    *   List/View: Empty (Public)

3.  **messages**: 
    *   List/View: Empty (Public)
    *   Create: `@request.auth.id != ""` (Authenticated users only)

4.  **private_messages**:
    *   **List/Search Rule:** `sender = @request.auth.id || recipient = @request.auth.id`
    *   **View Rule:** `sender = @request.auth.id || recipient = @request.auth.id`
    *   **Create Rule:** `sender = @request.auth.id`
    *   **Update Rule:** `sender = @request.auth.id || recipient = @request.auth.id`
