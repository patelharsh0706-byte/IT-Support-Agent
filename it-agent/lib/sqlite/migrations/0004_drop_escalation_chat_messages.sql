-- Data migration, no schema change.
--
-- `escalateServiceRequest()` used to copy the customer's escalation reason
-- into `chat_messages` as a customer-authored message, which rendered in
-- the CSR console as an ordinary reply — the "this case was escalated,
-- here's why" signal disappeared into the thread. The escalation is now
-- derived from `service_request.escalated_at` + `escalation_reason` (see
-- `buildCaseThread()`), so those copied rows are duplicates and would
-- render the reason twice: once as a marker, once as a reply.
--
-- Matched narrowly on all four of case/author/content/timestamp so a real
-- customer message that merely happens to repeat the reason text is left
-- alone — it would have to also share the exact escalation timestamp.
DELETE FROM `chat_messages`
WHERE `id` IN (
  SELECT m.`id`
  FROM `chat_messages` m
  JOIN `chat_sessions` s ON s.`id` = m.`chat_session_id`
  JOIN `service_request` r ON r.`id` = s.`service_request_id`
  WHERE r.`escalation_reason` IS NOT NULL
    AND m.`author_role` = 'customer'
    AND m.`is_private_note` = 0
    AND m.`content` = r.`escalation_reason`
    AND m.`timestamp` = r.`escalated_at`
);
