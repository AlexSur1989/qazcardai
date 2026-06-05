import { Badge } from "@/components/ui/badge";
import type { GoogleOAuthEnvStatus } from "@/lib/google-auth-config";

type Props = {
  status: GoogleOAuthEnvStatus;
};

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function GoogleOAuthEnvStatusCard({ status }: Props) {
  return (
    <div className="border-border rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Google OAuth</h3>
        <Badge variant={status.configured ? "default" : "outline"}>
          {status.configured ? "configured" : "not configured"}
        </Badge>
      </div>
      <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt>configured</dt>
          <dd className="text-foreground font-mono text-xs">{yesNo(status.configured)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt>clientId present</dt>
          <dd className="text-foreground font-mono text-xs">
            {yesNo(status.clientIdPresent)}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt>clientSecret present</dt>
          <dd className="text-foreground font-mono text-xs">
            {yesNo(status.clientSecretPresent)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 pt-1">
          <dt>callback URL</dt>
          <dd className="text-foreground break-all font-mono text-xs">
            {status.callbackUrl}
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground mt-3 text-xs">
        GOOGLE_CLIENT_SECRET не отображается. Задайте переменные в .env на сервере и
        добавьте callback URL в Google Cloud Console.
      </p>
    </div>
  );
}
