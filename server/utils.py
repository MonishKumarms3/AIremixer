import sys
import os
import json
import librosa
import numpy as np
import logging
from pydub import AudioSegment

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_audio_info(file_path):
    """
    Extract information from audio file including format, duration, and BPM
    
    Args:
        file_path: Path to the audio file
        
    Returns:
        dict: Audio information
    """
    logger.info(f"Analyzing audio file: {file_path}")
    try:
        logger.info("Starting audio analysis...")
        # Basic file information
        extension = os.path.splitext(file_path)[1].lower()
        format_type = extension[1:]  # Remove the dot
        
        # Load audio for librosa analysis
        y, sr = librosa.load(file_path, sr=None)
        
        # Get duration
        duration_sec = librosa.get_duration(y=y, sr=sr)
        
        # Get bitrate using pydub
        audio = AudioSegment.from_file(file_path)
        bitrate = audio.frame_rate * audio.sample_width * audio.channels * 8
        
        # Detect tempo
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0]
        
        # Detect key (this is a simplified approach)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_sum = np.sum(chroma, axis=1)
        key_idx = np.argmax(chroma_sum)
        
        # Map key index to key name
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key = key_names[key_idx]
        
        # Determine if it's major or minor
        # This is simplistic; a real implementation would use more advanced techniques
        minor_chroma = librosa.feature.chroma_cqt(y=y, sr=sr, bins_per_octave=12*3)
        minor_sum = np.sum(minor_chroma[9:], axis=1) / np.sum(minor_chroma, axis=1)
        
        if np.mean(minor_sum) > 0.2:  # Simple threshold for minor
            key += " minor"
        else:
            key += " major"
        
        # Create info dictionary
        info = {
            "format": format_type,
            "duration": int(duration_sec),
            "bpm": int(round(tempo)),
            "key": key,
            "bitrate": int(bitrate)
        }
        
        logger.info(f"Successfully analyzed audio file: {info}")
        return info
    
    except Exception as e:
        logger.error(f"Error analyzing audio file: {str(e)}")
        try:
            # Fallback to basic pydub analysis
            audio = AudioSegment.from_file(file_path)
            format_type = os.path.splitext(file_path)[1][1:].lower()
            return {
                "format": format_type,
                "duration": int(len(audio) / 1000),  # Convert ms to seconds
                "bpm": 0,  # Cannot determine BPM in fallback
                "key": "Unknown",
                "bitrate": int(audio.frame_rate * audio.sample_width * audio.channels * 8)
            }
        except Exception as inner_e:
            logger.error(f"Fallback analysis failed: {str(inner_e)}")
            # Return basic info if all analysis fails
            return {
                "format": os.path.splitext(file_path)[1][1:],
                "duration": 0,
                "bpm": 0,
                "key": "Unknown",
                "bitrate": 0
            }

if __name__ == "__main__":
    # Check if file path is provided
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)
    
    # Get and print audio info as JSON
    info = get_audio_info(file_path)
    print(json.dumps(info))
