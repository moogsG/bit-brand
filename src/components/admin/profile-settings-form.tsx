"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileSettingsFormProps {
	initialName: string;
	initialEmail: string;
	initialAvatarUrl: string | null;
}

function toInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function ProfileSettingsForm({
	initialName,
	initialEmail,
	initialAvatarUrl,
}: ProfileSettingsFormProps) {
	const { update } = useSession();
	const [name, setName] = useState(initialName);
	const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const previewName = name.trim().length > 0 ? name.trim() : initialName;
	const previewAvatar = avatarUrl.trim().length > 0 ? avatarUrl.trim() : undefined;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (name.trim().length < 2) {
			setError("Name must be at least 2 characters.");
			return;
		}

		setIsLoading(true);
		try {
			const res = await fetch("/api/settings/profile", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					avatarUrl: avatarUrl.trim(),
				}),
			});

			if (!res.ok) {
				const json = (await res.json()) as { error?: string };
				throw new Error(json.error ?? "Failed to update profile.");
			}

			const json = (await res.json()) as {
				profile: { name: string; avatarUrl: string | null };
			};

			await update({
				name: json.profile.name,
				image: json.profile.avatarUrl,
			});

			toast.success("Profile updated.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && <p className="text-sm text-destructive">{error}</p>}

			<div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
				<Avatar>
					{previewAvatar ? <AvatarImage src={previewAvatar} alt={previewName} /> : null}
					<AvatarFallback>{toInitials(previewName)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="text-sm font-medium">Profile Preview</p>
					<p className="truncate text-xs text-muted-foreground">{initialEmail}</p>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="profile-name">Display Name</Label>
				<Input
					id="profile-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={isLoading}
					required
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="profile-avatar-url">Profile Photo URL</Label>
				<Input
					id="profile-avatar-url"
					type="url"
					placeholder="https://example.com/avatar.jpg"
					value={avatarUrl}
					onChange={(e) => setAvatarUrl(e.target.value)}
					disabled={isLoading}
				/>
				<p className="text-xs text-muted-foreground">
					Leave blank to use your initials.
				</p>
			</div>

			<Button type="submit" disabled={isLoading}>
				{isLoading ? "Saving..." : "Save Profile"}
			</Button>
		</form>
	);
}
