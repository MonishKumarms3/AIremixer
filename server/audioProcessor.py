import sys
import os
import librosa
import numpy as np
from pydub import AudioSegment
import json
import tempfile
import subprocess
import logging
import random

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def install_package(package):
    """Install a package using pip if it's not already installed."""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        logger.info(f"Successfully installed {package}")
    except Exception as e:
        logger.error(f"Failed to install {package}: {str(e)}")
        raise

# Try to import packages, install if not available
try:
    import madmom
except ImportError:
    logger.info("madmom not found, attempting to install...")
    install_package("madmom")
    import madmom

try:
    from spleeter.separator import Separator
except ImportError:
    logger.info("spleeter not found, attempting to install...")
    install_package("spleeter")
    from spleeter.separator import Separator

def detect_tempo_and_beats(audio_path, method="auto"):
    """
    Detect tempo and beat positions in the audio file
    
    Args:
        audio_path: Path to the audio file
        method: Beat detection method ('auto', 'librosa', or 'madmom')
        
    Returns:
        tuple: (tempo, beat_frames)
    """
    logger.info(f"Detecting tempo and beats using {method} method")
    
    if method == "librosa" or method == "auto":
        try:
            y, sr = librosa.load(audio_path, sr=None)
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            beat_times = librosa.frames_to_time(beats, sr=sr)
            
            if len(beats) > 0 and tempo > 0:
                logger.info(f"Librosa detected tempo: {tempo} BPM with {len(beats)} beats")
                return tempo, beat_times
            elif method == "librosa":
                logger.warning("Librosa beat detection failed, but was explicitly requested")
                return None, None
        except Exception as e:
            logger.error(f"Error in librosa beat detection: {str(e)}")
            if method == "librosa":
                return None, None
    
    # Fall back to madmom or if madmom was explicitly requested
    if method == "madmom" or method == "auto":
        try:
            # Use madmom for potentially more accurate beat tracking
            from madmom.features.beats import RNNBeatProcessor, BeatTrackingProcessor
            from madmom.features.tempo import TempoEstimationProcessor
            
            # Process for beat detection
            proc = RNNBeatProcessor()(audio_path)
            beats = BeatTrackingProcessor(fps=100)(proc)
            
            # Process for tempo detection
            tempo_proc = TempoEstimationProcessor(fps=100)(proc)
            tempo = tempo_proc[0][0]  # Get the most likely tempo
            
            logger.info(f"Madmom detected tempo: {tempo} BPM with {len(beats)} beats")
            return tempo, beats
        except Exception as e:
            logger.error(f"Error in madmom beat detection: {str(e)}")
    
    # If both methods failed or no beats were found
    logger.warning("Beat detection failed with all methods")
    return None, None

def separate_audio_components(audio_path, output_dir):
    """
    Separate audio into components (vocals, drums, bass, other)
    using Spleeter
    
    Args:
        audio_path: Path to the audio file
        output_dir: Directory to save separated components
        
    Returns:
        dict: Paths to separated audio files
    """
    logger.info("Starting audio separation with Spleeter")
    
    try:
        # Create a separator with the 4stems configuration
        separator = Separator('spleeter:4stems')
        
        # Perform separation
        
        main_song=AudioSegment.from_file(audio_path)
        separator.separate_to_file(audio_path, output_dir)
        
        # Get the base filename without extension
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        component_dir = os.path.join(output_dir, base_name)
        
        # Paths to the separated components
        components = {
            'vocals': os.path.join(component_dir, 'vocals.wav'),
            'drums': os.path.join(component_dir, 'drums.wav'),
            'bass': os.path.join(component_dir, 'bass.wav'),
            'other': os.path.join(component_dir, 'other.wav')
        }
        
        # Verify files exist
        for component, path in components.items():
            if not os.path.exists(path):
                logger.warning(f"Component {component} file not found at {path}")
        
        logger.info("Audio separation completed successfully")
        return [components, main_song]
    
    except Exception as e:
        logger.error(f"Error during audio separation: {str(e)}")
        return None
def pick_loudest_bars(stem, beats_ms, bars=4, beats_per_bar=4):
    total_beats = len(beats_ms)
    window = beats_per_bar * bars
    max_rms = -1
    pick_start = 0
    if total_beats < window + 1:
        return stem
    for i in range(total_beats - window):
        start_ms = int(beats_ms[i])
        end_ms = int(beats_ms[i+window])
        segment = stem[start_ms:end_ms]
        rms = segment.rms
        if rms > max_rms:
            max_rms = rms
            pick_start = i
    start_ms = int(beats_ms[pick_start])
    end_ms = int(beats_ms[pick_start + window])
    return stem[start_ms:end_ms]

def create_extended_mix(components, output_path, intro_bars, outro_bars, preserve_vocals, tempo, beat_times, main_song):
    logger.info(f"Creating extended mix with {intro_bars} bars intro and {outro_bars} bars outro")

    try:
        beats_per_bar = 4
        intro_beats = intro_bars * beats_per_bar
        outro_beats = outro_bars * beats_per_bar

        if len(beat_times) < (intro_beats + outro_beats + 8):
            logger.warning(f"Not enough beats detected ({len(beat_times)}) for requested extension")
            return False
            
        # Get version number from filename (expects format like "something_v1.mp3")
        version = 1
        if "_v" in output_path:
            try:
                version = int(output_path.split("_v")[-1].split(".")[0])
            except:
                pass

        drums = AudioSegment.from_file(components['drums'])
        bass = AudioSegment.from_file(components['bass'])
        other = AudioSegment.from_file(components['other'])
        vocals = AudioSegment.from_file(components['vocals'])
        bass = bass + 12

        beat_times_ms = [t * 1000 for t in beat_times]

        # Pick stems for intro and outro
        full_intro_drums = pick_loudest_bars(drums, beat_times_ms, bars=intro_bars)
        full_intro_bass = pick_loudest_bars(bass, beat_times_ms, bars=intro_bars)
        full_intro_other = pick_loudest_bars(other, beat_times_ms, bars=intro_bars).apply_gain(9)
        intro_vocals = pick_loudest_bars(vocals, beat_times_ms, bars=intro_bars)

        full_outro_drums = pick_loudest_bars(drums, beat_times_ms, bars=outro_bars)
        full_outro_bass = pick_loudest_bars(bass, beat_times_ms, bars=outro_bars)
        full_outro_other = pick_loudest_bars(other, beat_times_ms, bars=outro_bars).apply_gain(9)
        outro_vocals = pick_loudest_bars(vocals, beat_times_ms, bars=outro_bars)

        # Set seed based on version for consistent shuffling per version
        random.seed(version * 42)
        
        # Shuffle order for intro
        intro_labels = ['drums', 'other', 'drums', 'vocals']
        intro_segments = [full_intro_drums, full_intro_other, full_intro_drums, intro_vocals]
        intro_zipped = list(zip(intro_labels, intro_segments))
        random.shuffle(intro_zipped)
        intro_components = [seg for (label, seg) in intro_zipped]
        shuffled_intro_order = [label for (label, seg) in intro_zipped]

        # Shuffle order for outro
        outro_labels = ['drums', 'other', 'drums', 'vocals']
        outro_segments = [full_outro_drums, full_outro_other, full_outro_drums, outro_vocals]
        outro_zipped = list(zip(outro_labels, outro_segments))
        random.shuffle(outro_zipped)
        outro_components = [seg for (label, seg) in outro_zipped]
        shuffled_outro_order = [label for (label, seg) in outro_zipped]
        
        # Reset random seed
        random.seed()

        # Mix creation
        full_intro = sum(intro_components).fade_in(2000)
        full_outro = sum(outro_components).fade_out(2000)

        main_audio = main_song
        extended_mix = full_intro.append(main_audio, crossfade=500)
         
        extended_mix.export(output_path, format=os.path.splitext(output_path)[1][1:])
        logger.info(f"Extended mix created successfully and saved to {output_path}")

        # Save the shuffle order JSON
        output_base = os.path.splitext(os.path.basename(output_path))[0]
        save_dir = r"C:\Users\Dhanush\Desktop\softwareLabs"
        os.makedirs(save_dir, exist_ok=True)
        shuffle_json_path = os.path.join(save_dir, f"{output_base}_shuffle_order.json")
        shuffle_info = {
            "intro_shuffle_order": shuffled_intro_order,
            "outro_shuffle_order": shuffled_outro_order
        }
        with open(shuffle_json_path, "w") as f:
            json.dump(shuffle_info, f, indent=2)
        logger.info(f"Shuffle order written to {shuffle_json_path}")

        return True

    except Exception as e:
        logger.error(f"Error creating extended mix: {str(e)}")
        return False
    
def process_audio(input_path, output_path, intro_bars=16, outro_bars=16, preserve_vocals=True, beat_detection="auto"):
    """
    Main function to process audio and create extended DJ version
    
    Args:
        input_path: Path to input audio file
        output_path: Path to save extended version
        intro_bars: Number of bars for intro
        outro_bars: Number of bars for outro
        preserve_vocals: Whether to include vocals in extended sections
        beat_detection: Method for beat detection
        
    Returns:
        bool: Success or failure
    """
    logger.info(f"Starting audio processing: {input_path}")
    logger.info(f"Parameters: intro_bars={intro_bars}, outro_bars={outro_bars}, preserve_vocals={preserve_vocals}, beat_detection={beat_detection}")
    
    try:
        # Convert parameters to correct types
        intro_bars = int(intro_bars)
        outro_bars = int(outro_bars)
        preserve_vocals = str(preserve_vocals).lower() == 'true'
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Step 1: Detect tempo and beats
            tempo, beat_times = detect_tempo_and_beats(input_path, method=beat_detection)
            if tempo is None or beat_times is None or len(beat_times) == 0:
                logger.error("Beat detection failed, cannot proceed")
                return False
            
            # Step 2: Separate audio components
            components,main_song = separate_audio_components(input_path, temp_dir)
            if components is None:
                logger.error("Audio separation failed, cannot proceed")
                return False
            
            # Step 3: Create extended mix
            success = create_extended_mix(
                components, 
                output_path, 
                intro_bars, 
                outro_bars, 
                preserve_vocals, 
                tempo, 
                beat_times,
                main_song
            )
            
            return success
    
    except Exception as e:
        logger.error(f"Error in audio processing: {str(e)}")
        return False

if __name__ == "__main__":
    # Check if required arguments are provided
    if len(sys.argv) < 3:
        print("Usage: python audioProcessor.py <input_path> <output_path> [intro_bars] [outro_bars] [preserve_vocals] [beat_detection]")
        sys.exit(1)
    
    # Parse arguments
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    intro_bars = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    outro_bars = int(sys.argv[4]) if len(sys.argv) > 4 else 16
    preserve_vocals = sys.argv[5].lower() == 'true' if len(sys.argv) > 5 else True
    beat_detection = sys.argv[6] if len(sys.argv) > 6 else "auto"
    
    # Process the audio
    success = process_audio(input_path, output_path, intro_bars, outro_bars, preserve_vocals, beat_detection)
    
    if success:
        print(json.dumps({"status": "success", "output_path": output_path}))
        sys.exit(0)
    else:
        print(json.dumps({"status": "error", "message": "Failed to process audio"}))
        sys.exit(1)
