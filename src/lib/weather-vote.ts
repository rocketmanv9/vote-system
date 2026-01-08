import { createSupabaseServerClient } from "@/lib/supabase";

export type WeatherVoteItem = {
  internal_job_id: number;
  property_name: string | null;
  service_name: string | null;
  forecast_date: string | null;
  lens_id: string | null;
  estimator_initials?: string | null;
  risk_level: string | null;
  route_start_time: string | null;
  route_end_time: string | null;
  max_rain_chance: number | null;
  max_rain_inches_route: number | null;
  hourly_weather: unknown;
  existing_vote?: {
    vote_value?: string | null;
    vote_reason?: string | null;
    voted_at?: string | null;
  } | null;
};

export type WeatherVoteVote = {
  internal_job_id: number;
  forecast_date: string | null;
  lens_id: string | null;
  vote_value: string | null;
  vote_reason: string | null;
  voted_at?: string | null;
};

export type WeatherVoteJobVote = {
  voter_type: string | null;
  voter_label: string | null;
  vote_value: string | null;
  vote_reason: string | null;
  voted_at?: string | null;
};

export type WeatherVoteContext = {
  token?: string | null;
  voter_type?: string | null;
  token_employee_id?: string | number | null;
  voter_phone_number?: string | null;
  employee_name?: string | null;
  employee_full_name?: string | null;
  employee_id?: string | number | null;
  token_expires_at?: string | null;
  token_revoked_at?: string | null;
  token_used_at?: string | null;
  batch_id?: string | number | null;
  batch_start_date?: string | null;
  batch_end_date?: string | null;
  batch_status?: string | null;
  batch_meta?: unknown;
  total_remaining?: number | null;
  total_items?: number | null;
  total_voted?: number | null;
  remaining_items?: number | null;
  voted_items?: number | null;
  items?: WeatherVoteItem[] | null;
  votes?: WeatherVoteVote[] | null;
};

export async function getWeatherVoteContext(token: string) {
  const supabase = createSupabaseServerClient();
  return supabase.rpc("rpc_weather_vote_get_context", { p_token: token });
}

export async function submitWeatherVote(input: {
  token: string;
  internalJobId: number;
  forecastDate: string | null;
  lensId: string | null;
  voteValue: string;
  voteReason?: string | null;
}) {
  const supabase = createSupabaseServerClient();
  return supabase.rpc("rpc_weather_vote_submit", {
    p_token: input.token,
    p_internal_job_id: input.internalJobId,
    p_forecast_date: input.forecastDate,
    p_lens_id: input.lensId,
    p_vote_value: input.voteValue,
    p_vote_reason: input.voteReason ?? null,
  });
}

export async function getWeatherVoteJobVotes(input: {
  token: string;
  internalJobId: number;
  forecastDate: string;
  lensId: string;
}) {
  const supabase = createSupabaseServerClient();
  return supabase.rpc("rpc_weather_vote_get_job_votes", {
    p_token: input.token,
    p_internal_job_id: input.internalJobId,
    p_forecast_date: input.forecastDate,
    p_lens_id: input.lensId,
  });
}
