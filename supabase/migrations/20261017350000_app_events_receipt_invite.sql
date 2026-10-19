-- receipt_read was sent by the app (receipt photo read) but rejected with 422, and
-- invite_rewarded is new: the 7 Pro days reaching the friend or the inviter
-- (launch/metricas-lancamento.md, invite funnel). Props: side, days; nothing personal.
alter table public.app_events drop constraint if exists app_events_event_check;
alter table public.app_events add constraint app_events_event_check check (event in (
  'app_open', 'hand_saved', 'limit_hit', 'paywall_shown', 'purchase', 'share_created', 'story_shared',
  'share_viewed', 'store_click', 'landing_view', 'link_shared', 'link_opened', 'invite_claimed', 'cancel_flow',
  'onboarding_step', 'paywall_closed', 'trial_start', 'lifetime_offer_shown', 'lifetime_purchased',
  'import_done', 'session_started', 'session_closed', 'notify_permission', 'replay_opened', 'review_prompt',
  'receipt_read', 'invite_rewarded'
));
