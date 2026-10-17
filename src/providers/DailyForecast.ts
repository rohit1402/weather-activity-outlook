export interface DailyForecast<TDay extends { date: string }> {
    timezone: string;
    days: TDay[];
}
