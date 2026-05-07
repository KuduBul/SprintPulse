-- Seed data for testing the Shoprite-X Polling App
-- Run this AFTER init.sql in Supabase SQL Editor

-- Create a sample poll
INSERT INTO "Poll" ("id", "title", "description", "facilitatorState", "isDeleted", "createdAt", "updatedAt")
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Team Retrospective - Sprint 42',
  'End of sprint retrospective for the Shoprite-X development team. Share your thoughts on what went well and what we can improve.',
  '{"_v":1,"votingOpen":true,"liveResults":false,"anonymise":true,"revealStage":"HIDDEN"}',
  false,
  NOW(),
  NOW()
);

-- Create questions for the poll
INSERT INTO "Question" ("id", "pollId", "text", "options", "allowCustom", "position", "displayOrder", "createdAt", "updatedAt")
VALUES
(
  'q1111111-1111-1111-1111-111111111111',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'What went well this sprint?',
  '["Collaboration", "Delivery speed", "Code quality", "Communication", "Testing"]',
  true,
  '{"x": 5, "y": 10, "width": 40, "height": 25}',
  0,
  NOW(),
  NOW()
),
(
  'q2222222-2222-2222-2222-222222222222',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'What should we improve?',
  '["Documentation", "Sprint planning", "Code reviews", "Deployment process", "Testing coverage"]',
  true,
  '{"x": 55, "y": 10, "width": 40, "height": 25}',
  1,
  NOW(),
  NOW()
),
(
  'q3333333-3333-3333-3333-333333333333',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'How would you rate this sprint overall?',
  '["Excellent", "Good", "Average", "Below average", "Poor"]',
  false,
  '{"x": 25, "y": 50, "width": 50, "height": 25}',
  2,
  NOW(),
  NOW()
);

-- Create a second poll (voting closed)
INSERT INTO "Poll" ("id", "title", "description", "facilitatorState", "isDeleted", "createdAt", "updatedAt")
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'PI Planning - Feature Prioritisation',
  'Vote on which features should be prioritised for the next PI increment.',
  '{"_v":1,"votingOpen":false,"liveResults":true,"anonymise":false,"revealStage":"COUNTS"}',
  false,
  NOW(),
  NOW()
);

INSERT INTO "Question" ("id", "pollId", "text", "options", "allowCustom", "position", "displayOrder", "createdAt", "updatedAt")
VALUES
(
  'q4444444-4444-4444-4444-444444444444',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Which feature is most important to you?',
  '["Real-time notifications", "Advanced reporting", "Mobile app", "API integrations", "Performance improvements"]',
  true,
  '{"x": 10, "y": 15, "width": 80, "height": 30}',
  0,
  NOW(),
  NOW()
),
(
  'q5555555-5555-5555-5555-555555555555',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'How confident are you in our current velocity?',
  '["Very confident", "Somewhat confident", "Neutral", "Not very confident", "Not confident at all"]',
  false,
  NULL,
  1,
  NOW(),
  NOW()
);

-- Add some sample responses to the second poll
INSERT INTO "Response" ("id", "pollId", "questionId", "participantName", "sessionToken", "selectedOption", "customText", "isTest", "createdAt", "updatedAt")
VALUES
(
  'r1111111-1111-1111-1111-111111111111',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'q4444444-4444-4444-4444-444444444444',
  'Alice',
  '11111111-aaaa-bbbb-cccc-111111111111',
  'Real-time notifications',
  NULL,
  false,
  NOW(),
  NOW()
),
(
  'r2222222-2222-2222-2222-222222222222',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'q5555555-5555-5555-5555-555555555555',
  'Alice',
  '11111111-aaaa-bbbb-cccc-111111111111',
  'Somewhat confident',
  NULL,
  false,
  NOW(),
  NOW()
),
(
  'r3333333-3333-3333-3333-333333333333',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'q4444444-4444-4444-4444-444444444444',
  'Bob',
  '22222222-aaaa-bbbb-cccc-222222222222',
  'Mobile app',
  NULL,
  false,
  NOW(),
  NOW()
),
(
  'r4444444-4444-4444-4444-444444444444',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'q5555555-5555-5555-5555-555555555555',
  'Bob',
  '22222222-aaaa-bbbb-cccc-222222222222',
  'Very confident',
  NULL,
  false,
  NOW(),
  NOW()
),
(
  'r5555555-5555-5555-5555-555555555555',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'q4444444-4444-4444-4444-444444444444',
  'Charlie',
  '33333333-aaaa-bbbb-cccc-333333333333',
  'Other',
  'Better developer experience tooling',
  false,
  NOW(),
  NOW()
),
(
  'r6666666-6666-6666-6666-666666666666',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'q5555555-5555-5555-5555-555555555555',
  'Charlie',
  '33333333-aaaa-bbbb-cccc-333333333333',
  'Neutral',
  NULL,
  false,
  NOW(),
  NOW()
);

-- Add audit log entries
INSERT INTO "AuditLog" ("id", "pollId", "action", "actor", "metadata", "createdAt")
VALUES
(
  'al111111-1111-1111-1111-111111111111',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'POLL_CREATED',
  'admin',
  '{"title": "Team Retrospective - Sprint 42"}',
  NOW()
),
(
  'al222222-2222-2222-2222-222222222222',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'POLL_CREATED',
  'admin',
  '{"title": "PI Planning - Feature Prioritisation"}',
  NOW()
),
(
  'al333333-3333-3333-3333-333333333333',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'VOTING_CLOSED',
  'admin',
  NULL,
  NOW()
);
