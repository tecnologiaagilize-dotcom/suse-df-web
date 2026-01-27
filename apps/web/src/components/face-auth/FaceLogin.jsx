import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function FaceLogin({ onFaceVerified }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models'; // Ensure models are in public/models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  const startVideo = () => {
    setCapturing(true);
    navigator.mediaDevices
      .getUserMedia({ video: {} })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error(err));
  };

  const handleVideoOnPlay = () => {
    setInterval(async () => {
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
        const displaySize = {
          width: videoRef.current.width,
          height: videoRef.current.height,
        };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();
        
        if (detections.length > 0) {
          // Here we would match against stored face descriptor
          // For now, we just verify a face is present
          console.log("Face detected");
          onFaceVerified(true);
          setCapturing(false);
          // Stop video stream
          const stream = videoRef.current.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
        }
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {modelsLoaded ? (
        <>
          {!capturing && (
            <button
              onClick={startVideo}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Iniciar Login Facial
            </button>
          )}
          {capturing && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                height={480}
                width={640}
                onPlay={handleVideoOnPlay}
                className="rounded-lg shadow-lg"
              />
              <canvas ref={canvasRef} className="absolute top-0 left-0" />
            </div>
          )}
        </>
      ) : (
        <div>Carregando modelos de IA...</div>
      )}
    </div>
  );
}
