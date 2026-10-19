-- trial_end comes from RevenueCat's webhook (web /api/revenuecat), not the app: a trial that
-- turned into a paid period or ran out unpaid. Props: result (paid / ended), plan. Nothing personal.
alter table public.app_events drop constraint if exists app_events_event_check;
alter table public.app_events add constraint app_events_event_check check (event in (
  'app_open', 'hand_saved', 'limit_hit', 'paywall_shown', 'purchase', 'share_created', 'story_shared',
  'share_viewed', 'store_click', 'landing_view', 'link_shared', 'link_opened', 'invite_claimed', 'cancel_flow',
  'onboarding_step', 'paywall_closed', 'trial_start', 'lifetime_offer_shown', 'lifetime_purchased',
  'import_done', 'session_started', 'session_closed', 'notify_permission', 'replay_opened', 'review_prompt',
  'receipt_read', 'invite_rewarded', 'trial_end'
));
