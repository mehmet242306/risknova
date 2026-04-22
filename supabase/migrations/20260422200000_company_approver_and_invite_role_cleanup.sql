-- =============================================================================
-- is_company_approver access_role desteği + invited_role 'staff' temizligi
-- =============================================================================
-- Iki düzeltmeyi birarada yapar:
--
-- 1) is_company_approver: Bugün eklenen company_memberships.access_role'u
--    bilmiyordu. Yeni davet edilen 'admin' veya 'owner' rollerindeki
--    kullanicilar UI'da canManage=true görse bile RLS 'denied' dönerdi.
--    Yeni versiyon:
--      - can_approve_join_requests = true (legacy explicit flag)
--      - membership_role = 'owner' (legacy professional role)
--      - access_role in ('owner','admin') (yeni 5-role auth)
--    üç koldan herhangi birini eşleştirirse TRUE döner.
--
-- 2) company_invitations.invited_role check'inde 'staff' vardı ancak
--    company_memberships.access_role check'inde yok; davette 'staff'
--    seçilirse accept sırasında sessizce 'viewer'a düşüyordu. 'staff'
--    invitable rol olarak UI'dan kaldırıldı (API zod schema da destekler
--    4 rol). DB check de 5'li kanonik modelle aynı hale getirildi.
-- =============================================================================

create or replace function public.is_company_approver(p_company_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_identity_id = p_company_identity_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and (
        cm.can_approve_join_requests = true
        or cm.membership_role = 'owner'
        or cm.access_role in ('owner', 'admin')
      )
  )
$$;

alter table public.company_invitations
  drop constraint if exists company_invitations_invited_role_check;

-- 'staff' artık invitable rol değil — UI 4-role modeliyle (admin/manager/
-- editor/viewer) uyumlu olacak şekilde canonical 5-role (+ owner) kanonik set.
alter table public.company_invitations
  add constraint company_invitations_invited_role_check
  check (invited_role in ('owner', 'admin', 'manager', 'editor', 'viewer'));
