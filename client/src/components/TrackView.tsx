/** @format */

import React, { useState, useRef, useEffect } from "react";
import { AudioTrack } from "@shared/schema";
import { formatDuration } from "@/lib/audio";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface TrackViewProps {
	track: AudioTrack;
	type: "original" | "extended";
	version: number; // Added version prop
}

const TrackView: React.FC<TrackViewProps> = ({ track, type, version }) => {
	// Added version to props
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false); // Added state for processing
	const audioRef = useRef<HTMLAudioElement>(null);
	const progressIntervalRef = useRef<number>();
	const { toast } = useToast();

	// Calculate display values
	const displayTitle =
		type === "original"
			? track.originalFilename
			: `${track.originalFilename.replace(/\.[^/.]+$/, "")} (Extended Mix v${
					version + 1
			  })${track.originalFilename.match(/\.[^/.]+$/)?.[0] || ""}`;

	const displayDuration =
		type === "original" ? track.duration || 0 : track.extendedDuration || 0;

	const displayDetails = `${
		type === "original" ? "Original" : "Extended"
	} • ${formatDuration(displayDuration)} ${
		track.bpm ? `• ${track.bpm} BPM` : ""
	}`;

	// Set up audio playback
	useEffect(() => {
		if (audioRef.current) {
			const audio = audioRef.current;

			const updateTime = () => {
				setCurrentTime(audio.currentTime);
			};

			const onLoadedMetadata = () => {
				setDuration(audio.duration);
			};

			const onEnded = () => {
				setIsPlaying(false);
				setCurrentTime(0);
				clearInterval(progressIntervalRef.current);
			};

			audio.addEventListener("loadedmetadata", onLoadedMetadata);
			audio.addEventListener("ended", onEnded);

			// Clean up
			return () => {
				audio.removeEventListener("loadedmetadata", onLoadedMetadata);
				audio.removeEventListener("ended", onEnded);
				clearInterval(progressIntervalRef.current);
			};
		}
	}, [track.id, type]);

	const togglePlayPause = () => {
		if (!audioRef.current) return;

		if (isPlaying) {
			audioRef.current.pause();
			clearInterval(progressIntervalRef.current);
			setIsPlaying(false);
		} else {
			audioRef.current.play();
			progressIntervalRef.current = window.setInterval(() => {
				if (audioRef.current) {
					setCurrentTime(audioRef.current.currentTime);
				}
			}, 100);
			setIsPlaying(true);
		}
	};

	const handleSkipBack = () => {
		if (!audioRef.current) return;
		audioRef.current.currentTime = Math.max(
			0,
			audioRef.current.currentTime - 10
		);
		setCurrentTime(audioRef.current.currentTime);
	};

	const handleSkipForward = () => {
		if (!audioRef.current) return;
		audioRef.current.currentTime = Math.min(
			audioRef.current.duration,
			audioRef.current.currentTime + 10
		);
		setCurrentTime(audioRef.current.currentTime);
	};

	// Handle seeking on progress bar click
	const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!audioRef.current || !duration) return;

		const progressBar = e.currentTarget;
		const rect = progressBar.getBoundingClientRect();
		const pos = (e.clientX - rect.left) / rect.width;
		const newTime = pos * duration;

		audioRef.current.currentTime = newTime;
		setCurrentTime(newTime);
	};

	return (
		<div>
			<div className='flex flex-col md:flex-row items-center md:items-start gap-4 mb-6'>
				<div className='w-32 h-32 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center shadow-md flex-shrink-0'>
					<span className='material-icons text-white text-5xl'>
						{type === "original" ? "music_note" : "equalizer"}
					</span>
				</div>

				<div className='flex-1'>
					<div className='text-center md:text-left mb-2'>
						<h3 className='text-xl font-bold'>{displayTitle}</h3>
						<p className='text-gray-500'>{displayDetails}</p>
					</div>

					<div className='flex flex-col gap-2 text-sm'>
						<div className='flex flex-wrap items-center gap-4'>
							<div className='flex items-center gap-2'>
								<span className='text-gray-500'>Format:</span>
								<span className='font-medium'>
									{track.format
										? `${track.format.toUpperCase()}${
												track.bitrate
													? `, ${Math.round(track.bitrate / 1000)}kbps`
													: ""
										  }`
										: "Unknown"}
								</span>
							</div>
							<div className='flex items-center gap-2'>
								<span className='text-gray-500'>Key:</span>
								<span className='font-medium'>{track.key || "Unknown"}</span>
							</div>
						</div>
						<div className='flex flex-wrap items-center gap-4'>
							<div className='flex items-center gap-2'>
								<span className='text-gray-500'>Tempo:</span>
								<span className='font-medium'>
									{track.bpm ? `${track.bpm} BPM` : "Unknown"}
								</span>
							</div>
							<div className='flex items-center gap-2'>
								<span className='text-gray-500'>Duration:</span>
								<span className='font-medium'>
									{formatDuration(displayDuration)}
								</span>
							</div>
						</div>
						{type === "extended" && (
							<div className='flex items-center gap-2'>
								<span className='text-gray-500'>Intro Length:</span>
								<span className='font-medium'>
									{track.settings?.introLength} bars
								</span>
							</div>
						)}
					</div>
				</div>
			</div>

			<div className='mb-4'>
				<h4 className='font-medium mb-2'>Waveform</h4>
				<div className='waveform-container bg-gray-900 rounded-lg'>
					{/* Waveform visualization would be enhanced with WaveSurfer.js in a production app */}
					<div className='waveform'>
						<div className='waveform-bars flex items-center h-full p-4'>
							{Array(type === "original" ? 120 : 150)
								.fill(0)
								.map((_, i) => {
									const isIntroSection =
										type === "extended" &&
										i <=
											((track.settings?.introLength || 16) / track.bpm) *
												60 *
												(150 / duration);
									const isCurrentlyPlaying =
										i / (type === "original" ? 120 : 150) <=
										currentTime / duration;

									return (
										<div
											key={i}
											className={`waveform-bar transition-colors duration-300`}
											style={{
												height: `${Math.floor(Math.random() * 70 + 10)}px`,
												width: "3px",
												margin: "0 1px",
												background:
													type === "extended"
														? isCurrentlyPlaying
															? isIntroSection
																? "linear-gradient(to top, #10b981, #34d399)" // emerald gradient for playing intro
																: "linear-gradient(to top, #7c3aed, #a78bfa)" // purple gradient for playing main
															: isIntroSection
															? "linear-gradient(to top, #064e3b, #065f46)" // darker emerald for unplayed intro
															: "linear-gradient(to top, #4c1d95, #5b21b6)" // darker purple for unplayed main
														: isCurrentlyPlaying
														? "linear-gradient(to top, #7c3aed, #a78bfa)"
														: "linear-gradient(to top, #4b5563, #6b7280)",
											}}></div>
									);
								})}
						</div>
					</div>
				</div>

				<div
					className='player-progress mt-2 mb-2 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer relative'
					onClick={handleProgressClick}>
					{type === "extended" && (
						<div
							className='h-full bg-gradient-to-r from-emerald-500 to-emerald-400 absolute'
							style={{
								width: `${
									((track.settings?.introLength || 16) / track.bpm) *
									60 *
									(100 / duration)
								}%`,
							}}
						/>
					)}
					<div
						className='h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300'
						style={{
							width: `${(currentTime / (duration || 1)) * 100}%`,
						}}
					/>
				</div>

				<div className='player-controls flex items-center'>
					<button
						className='p-2 rounded-full hover:bg-gray-100'
						onClick={handleSkipBack}>
						<span className='material-icons'>skip_previous</span>
					</button>
					<button
						className='p-2 rounded-full hover:bg-gray-100'
						onClick={togglePlayPause}>
						<span className='material-icons'>
							{isPlaying ? "pause" : "play_arrow"}
						</span>
					</button>
					<button
						className='p-2 rounded-full hover:bg-gray-100'
						onClick={handleSkipForward}>
						<span className='material-icons'>skip_next</span>
					</button>
					<span className='text-sm text-gray-500 ml-2 -mt-2'>
						{formatDuration(currentTime)} / {formatDuration(duration)}
					</span>
				</div>
			</div>

			{type === "extended" && track.status === "completed" && (
				<div className='mt-4'>
					<div className='grid grid-cols-1 gap-6'>
						{[...(track.extendedPaths || [])].reverse().map((path, idx) => {
							const versionIndex = (track.extendedPaths?.length || 1) - idx - 1;
							return (
								<div
									key={versionIndex}
									className='bg-gray-50 rounded-lg p-4 mb-4'>
									<div className='flex justify-between items-center mb-4'>
										<div className='text-lg font-medium'>
											Version {versionIndex + 1}
										</div>
										<a
											href={`/api/tracks/${track.id}/download?version=${versionIndex}`}
											className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
											download>
											<span className='material-icons text-sm mr-1'>
												download
											</span>
											Download V{versionIndex + 1}
										</a>
									</div>

									<div className='waveform-container bg-gray-900 rounded-lg'>
										<div className='waveform'>
											<div className='waveform-bars flex items-center h-full p-4'>
												{Array(150)
													.fill(0)
													.map((_, i) => {
														const isIntroSection =
															i <=
															((track.settings?.introLength || 16) /
																track.bpm) *
																60 *
																(150 /
																	(track.extendedDurations?.[versionIndex] ||
																		0));
														return (
															<div
																key={i}
																className='waveform-bar transition-colors duration-300'
																style={{
																	height: `${Math.floor(
																		Math.random() * 70 + 10
																	)}px`,
																	width: "3px",
																	margin: "0 1px",
																	background: isIntroSection
																		? "linear-gradient(to top, #064e3b, #065f46)"
																		: "linear-gradient(to top, #4c1d95, #5b21b6)",
																}}></div>
														);
													})}
											</div>
										</div>
									</div>

									<div className='player-controls flex items-center mt-2'>
										<button
											className='p-2 rounded-full hover:bg-gray-200'
											onClick={() => handleSkipBack()}>
											<span className='material-icons'>skip_previous</span>
										</button>
										<button
											className='p-2 rounded-full hover:bg-gray-200'
											onClick={() => togglePlayPause()}>
											<span className='material-icons'>
												{isPlaying ? "pause" : "play_arrow"}
											</span>
										</button>
										<button
											className='p-2 rounded-full hover:bg-gray-200'
											onClick={() => handleSkipForward()}>
											<span className='material-icons'>skip_next</span>
										</button>
										<span className='text-sm text-gray-500 ml-2'>
											{formatDuration(currentTime)} /{" "}
											{formatDuration(
												track.extendedDurations?.[versionIndex] || 0
											)}
										</span>
									</div>

									<audio
										src={`/api/audio/${track.id}/extended?version=${versionIndex}`}
										preload='metadata'
										style={{ display: "none" }}
									/>
								</div>
							);
						})}
						<button
							className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50'
							onClick={async () => {
								try {
									setIsProcessing(true);
									const processResponse = await fetch(
										`/api/tracks/${track.id}/process`,
										{
											method: "POST",
											headers: {
												"Content-Type": "application/json",
											},
											body: JSON.stringify(track.settings),
										}
									);

									if (!processResponse.ok) {
										throw new Error("Failed to start regeneration");
									}

									const checkStatus = async () => {
										const statusResponse = await fetch(
											`/api/tracks/${track.id}/status`
										);
										const data = await statusResponse.json();

										if (data.status === "completed") {
											// Force refetch track data
											const updatedTrackResponse = await fetch(
												`/api/tracks/${track.id}`,
												{
													headers: {
														"Cache-Control": "no-cache",
														Pragma: "no-cache",
													},
												}
											);
											const updatedTrack = await updatedTrackResponse.json();
											const newVersion =
												(updatedTrack.extendedPaths?.length || 1) - 1;

											if (audioRef.current) {
												audioRef.current.src = `/api/audio/${track.id}/extended?version=${newVersion}`;
												await audioRef.current.load();
											}
											setIsProcessing(false);

											// Update React Query cache
											await queryClient.setQueryData(
												[`/api/tracks/${track.id}`],
												updatedTrack
											);
											await queryClient.invalidateQueries({
												queryKey: [`/api/tracks/${track.id}`],
											});
											await queryClient.refetchQueries({
												queryKey: [`/api/tracks/${track.id}`],
											});
											toast({
												title: "Success",
												description: "New extended mix generated successfully!",
												duration: 5000,
											});
											return true;
										} else if (data.status === "processing") {
											return false;
										} else {
											throw new Error("Processing failed");
										}
									};

									const intervalId = setInterval(async () => {
										try {
											const isCompleted = await checkStatus();
											if (isCompleted) {
												clearInterval(intervalId);
											}
										} catch (error) {
											clearInterval(intervalId);
											setIsProcessing(false);
											toast({
												title: "Error",
												description: "Failed to regenerate extended mix",
												variant: "destructive",
												duration: 5000,
											});
										}
									}, 2000);
								} catch (error) {
									console.error("Regeneration error:", error);
									toast({
										title: "Error",
										description: "Failed to regenerate extended mix",
										variant: "destructive",
										duration: 5000,
									});
									setIsProcessing(false);
								}
							}}
							disabled={
								track.status === "processing" ||
								isProcessing ||
								(track.extendedPaths?.length || 0) >= 4
							}>
							{isProcessing ? (
								<>
									<svg
										className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'>
										<circle
											className='opacity-25'
											cx='12'
											cy='12'
											r='10'
											stroke='currentColor'
											strokeWidth='4'></circle>
										<path
											className='opacity-75'
											fill='currentColor'
											d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
									</svg>
									Processing...
								</>
							) : (
								<>
									<span className='material-icons text-sm mr-1'>autorenew</span>
									Regenerate Extended Mix
								</>
							)}
						</button>
					</div>
				</div>
			)}

			<audio
				ref={audioRef}
				src={`/api/audio/${track.id}/${type}`}
				preload='metadata'
				style={{ display: "none" }}
			/>
		</div>
	);
};

export default TrackView;
