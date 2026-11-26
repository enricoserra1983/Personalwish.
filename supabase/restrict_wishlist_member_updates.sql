-- MyPersonalWish: limit participant self-updates to chat privacy only.
-- RLS still determines which membership row the participant may update.

REVOKE UPDATE ON TABLE public.wishlist_members FROM anon, authenticated;

GRANT UPDATE (hide_messages_from_owner)
ON TABLE public.wishlist_members
TO authenticated;
