import { LoginForm } from "@/components/auth/login-form";
import { themeConfig } from "@/lib/theme.config";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          {/* Logo placeholder — replace with themeConfig.brand assets */}
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-lg">
              {themeConfig.brand.shortName}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {themeConfig.brand.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {themeConfig.brand.tagline}
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
