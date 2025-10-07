-- Create prompt_versions table to store version history
CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  prompt_template text NOT NULL,
  change_message text,
  is_live boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(prompt_id, version_number)
);

-- Add version tracking to conversations
ALTER TABLE public.conversations 
ADD COLUMN prompt_version_id uuid REFERENCES public.prompt_versions(id);

-- Enable RLS on prompt_versions
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompt_versions
CREATE POLICY "Users can view versions of prompts they have access to"
ON public.prompt_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.prompts
    WHERE prompts.id = prompt_versions.prompt_id
    AND (
      prompts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_members.organization_id = prompts.organization_id
        AND organization_members.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can create versions for their prompts"
ON public.prompt_versions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.prompts
    WHERE prompts.id = prompt_versions.prompt_id
    AND prompts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update versions of their prompts"
ON public.prompt_versions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.prompts
    WHERE prompts.id = prompt_versions.prompt_id
    AND prompts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete versions of their prompts"
ON public.prompt_versions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.prompts
    WHERE prompts.id = prompt_versions.prompt_id
    AND prompts.user_id = auth.uid()
  )
);

-- Create trigger to auto-create initial version when prompt is created
CREATE OR REPLACE FUNCTION public.create_initial_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.prompt_versions (
    prompt_id,
    version_number,
    title,
    description,
    prompt_template,
    change_message,
    is_live,
    created_by
  ) VALUES (
    NEW.id,
    1,
    NEW.title,
    NEW.description,
    NEW.prompt_template,
    'Initial version',
    true,
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_prompt_created_create_version
AFTER INSERT ON public.prompts
FOR EACH ROW
EXECUTE FUNCTION public.create_initial_prompt_version();