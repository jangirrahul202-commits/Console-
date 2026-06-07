import Lottie from 'lottie-react';
// @ts-ignore
import loadingAnimation from '../../public/animations/loading.json';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'medium'
}: LoadingSpinnerProps) {
  const sizeMap = {
    small: 100,
    medium: 150,
    large: 200
  };

  return (
    <div className="loading-spinner-overlay">
      <div className="loading-spinner-content">
        <div 
          className="loading-spinner-animation"
          style={{ width: sizeMap[size], height: sizeMap[size] }}
        >
          <Lottie 
            animationData={loadingAnimation}
            loop={true}
          />
        </div>
        <div className="loading-spinner-text">{message}</div>
      </div>
    </div>
  );
}
