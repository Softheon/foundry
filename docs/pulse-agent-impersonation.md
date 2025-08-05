# Pulse Agent User Impersonation

This document explains how to configure your pulse agent to send pulses for queries in personal collections.

## Overview

Personal collections in Foundry have special permission handling - they can only be accessed by their owners. However, pulse agents (service accounts with pulse permissions) can now impersonate users to access their personal collections when sending pulses.

## How It Works

When your pulse agent makes a request to the `/api/pulse/test` endpoint, it can include a special header to temporarily impersonate a user:

```
X-Impersonate-User: user@example.com
```

The system will:
1. Verify that the current authenticated user is a pulse user (service account)
2. Look up the target user by email
3. Temporarily switch the user context to the target user
4. Execute the pulse operation with the target user's permissions
5. Restore the original user context

## Usage

### For Your Pulse Agent

When sending a pulse that contains cards from a personal collection, include the impersonation header:

```bash
curl -X POST "https://your-foundry-instance.com/api/pulse/test" \
  -H "Content-Type: application/json" \
  -H "X-Metabase-Session: your-session-token" \
  -H "X-Impersonate-User: owner@example.com" \
  -d '{
    "name": "Test Pulse",
    "cards": [{"id": 123, "include_csv": false, "include_xls": false}],
    "channels": [{"channel_type": "email", "recipients": ["recipient@example.com"]}]
  }'
```

### Requirements

1. **Pulse User Permission**: Your agent must be authenticated as a user with pulse permissions (`*is-pulse-user?*` must be true)
2. **Valid Target User**: The email in the `X-Impersonate-User` header must correspond to an active user in the system
3. **Personal Collection Access**: The target user must own the personal collection containing the cards you want to send

### Security Considerations

- Only users with pulse permissions can use impersonation
- Impersonation is limited to the duration of the single API request
- The feature is specifically designed for pulse operations and doesn't affect other API endpoints
- All impersonation attempts are logged with the original and target user information

## Error Handling

The system will return appropriate HTTP error codes:

- **400 Bad Request**: Target user not found
- **403 Forbidden**: Current user doesn't have pulse permissions to impersonate others

## Example Scenarios

### Scenario 1: Personal Dashboard Pulse
A user has created a dashboard in their personal collection and wants to receive it as a pulse. Your agent can impersonate them to send the pulse.

### Scenario 2: Cross-User Pulse Management
An admin wants to manage pulses for users' personal collections through your agent. The agent can impersonate each user as needed.

## Limitations

- Impersonation only works for the `/api/pulse/test` endpoint currently
- The target user must be active in the system
- Personal collections still maintain their privacy - only the owner (or impersonated requests) can access them

## Troubleshooting

If you encounter issues:

1. Verify your agent has pulse permissions
2. Check that the target user email is correct and the user is active
3. Ensure the cards you're trying to send are actually in the target user's personal collection
4. Check the server logs for detailed error messages
