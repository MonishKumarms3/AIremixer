/** @format */

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import UploadSection from "@/components/UploadSection";
import SettingsPanel from "@/components/SettingsPanel";
import ProcessingInfo from "@/components/ProcessingInfo";
import TrackPreview from "@/components/TrackPreview";
import CompletedMixCard from "@/components/CompletedMixCard";
import { AudioTrack } from "@shared/schema";

const Home: React.FC = () => {
	const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isProcessed, setIsProcessed] = useState(false);
	const queryClient = useQueryClient();

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
