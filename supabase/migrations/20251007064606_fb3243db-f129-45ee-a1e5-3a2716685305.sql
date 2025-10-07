-- Drop existing problematic policies
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON public.organization_members;

-- Create security definer function to check organization role
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = ANY(_roles)
  )
$$;

-- Create security definer function to check if user is member of any org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Users can view members of their organizations"
ON public.organization_members FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can add members"
ON public.organization_members FOR INSERT
WITH CHECK (public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners and admins can update members"
ON public.organization_members FOR UPDATE
USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners and admins can remove members"
ON public.organization_members FOR DELETE
USING (public.has_org_role(auth.uid(), organization_id, ARRAY['owner', 'admin']));