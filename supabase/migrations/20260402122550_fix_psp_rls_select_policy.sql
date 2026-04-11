
DROP POLICY IF EXISTS psp_select ON personnel_special_policies;
CREATE POLICY psp_select ON personnel_special_policies
  FOR SELECT
  TO authenticated
  USING (true);
;
