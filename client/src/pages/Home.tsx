/** @format */

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import UploadSection from "@/components/UploadSection";
import SettingsPanel from "@/components/SettingsPanel";
import ProcessingInfo from "@/components/ProcessingInfo";
import TrackPreview from "@/components/TrackPreview";
import CompletedMixCard from "@/components/CompletedMixCard";
import { AudioTrack } from "@shared/schema";

const Home: React.FC = () => {
	const { toast } = useToast();
	const [currentTrackId, setCurrentTrackId] = useState<number | null>(() => {
		const saved = localStorage.getItem("currentTrackId");
		return saved ? parseInt(saved, 10) : null;
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const [isProcessed, setIsProcessed] = useState(() => {
		return localStorage.getItem("isProcessed") === "true";
	});
	const queryClient = useQueryClient();

	// Persist state changes to localStorage
	useEffect(() => {
		if (currentTrackId) {
			localStorage.setItem("currentTrackId", currentTrackId.toString());
		} else {
			localStorage.removeItem("currentTrackId");
		}
	}, [currentTrackId]);

	useEffect(() => {
		localStorage.setItem("isProcessed", isProcessed.toString());
	}, [isProcessed]);

	const { data: tracks } = useQuery<AudioTrack[]>({
		queryKey: ["/api/tracks"],
		staleTime: Infinity,
		cacheTime: Infinity,
		onSuccess: (tracks) => {
			// Set the most recent track as current if none selected
			if (!currentTrackId && tracks?.length > 0) {
				setCurrentTrackId(tracks[0].id);
				setIsProcessed(tracks[0].status === "completed");
			}
		},
	});

	const { data: track } = useQuery<AudioTrack>({
		queryKey: currentTrackId ? [`/api/tracks/${currentTrackId}`] : ["no-track"],
		enabled: !!currentTrackId,
		refetchInterval: isProcessing ? 2000 : false,
	});

	// Check if the track is already processed when loading
	useEffect(() => {
		if (track && track.status === "completed" && track.extendedPath) {
			setIsProcessed(true);
			setIsProcessing(false);
		}
	}, [track]);

	const handleUploadSuccess = (trackId: number) => {
		setCurrentTrackId(trackId);
		setIsProcessed(false);
	};

	const handleProcessingStart = () => {
		setIsProcessing(true);
	};

	const handleProcessingComplete = () => {
		setIsProcessing(false);
		setIsProcessed(true);
		// Refresh track data to get the latest info
		queryClient.invalidateQueries({
			queryKey: [`/api/tracks/${currentTrackId}`],
		});
	};

	const handleProcessingCancel = () => {
		setIsProcessing(false);
	};

	const handlePreview = () => {
		// Switch to the extended tab in TrackPreview
		// This is handled through props
	};

	const handleAdjust = () => {
		// Allow user to adjust settings and reprocess
		setIsProcessed(false);
	};

	return (
		<div className='container mx-auto px-4 py-8'>
			<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
				{/* Left column: Upload & Controls */}
				<div className='lg:col-span-4 space-y-6'>
					<UploadSection onUploadSuccess={handleUploadSuccess} />
					<button
						onClick={async () => {
							if (
								window.confirm(
									"Are you sure you want to clear all tracks? This cannot be undone."
								)
							) {
								try {
									await fetch("/api/tracks", { method: "DELETE" });
									queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
									setCurrentTrackId(null);
									setIsProcessed(false);
									toast({
										title: "Tracks Cleared",
										description: "All tracks have been removed successfully.",
									});
								} catch (error) {
									toast({
										title: "Error",
										description: "Failed to clear tracks.",
										variant: "destructive",
									});
								}
							}
						}}
						className='w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm flex items-center justify-center gap-2'>
						<span className='material-icons text-sm'>delete</span>
						Clear All Tracks
					</button>

					{isProcessing ? (
						<ProcessingInfo
							trackId={currentTrackId!}
							onComplete={handleProcessingComplete}
							onCancel={handleProcessingCancel}
						/>
					) : (
						<SettingsPanel
							trackId={currentTrackId}
							onProcessingStart={handleProcessingStart}
							disabled={isProcessed}
						/>
					)}
				</div>

				{/* Right column: Results & Preview */}
				<div className='lg:col-span-8'>
					<TrackPreview trackId={currentTrackId} isProcessed={isProcessed} />
				</div>
			</div>
		</div>
	);
};

export default Home;
