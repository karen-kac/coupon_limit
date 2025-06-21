import React, { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface ExplosionEffectProps {
  onComplete: () => void;
  useLottie?: boolean;
}

const ExplosionEffect: React.FC<ExplosionEffectProps> = ({ onComplete, useLottie = true }) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    emoji: string;
  }>>([]);

  useEffect(() => {
    // Lottieアニメーション用タイマー（10秒で強制終了）
    if (useLottie) {
      const fallbackTimer = setTimeout(() => {
        onComplete();
      }, 10000); // 10秒で強制終了
      return () => clearTimeout(fallbackTimer);
    }

    if (!useLottie) {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
      const emojis = ['💫', '⭐', '✨', '💥', '🎆', '🌟'];
      
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 0.5) * 400,
        size: Math.random() * 20 + 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        emoji: emojis[Math.floor(Math.random() * emojis.length)]
      }));
      
      setParticles(newParticles);

      // パーティクルアニメーション用タイマー（10秒で終了）
      const timer = setTimeout(() => {
        onComplete();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [onComplete, useLottie]);

  if (useLottie) {
    return (
      <div className="explosion-container lottie-explosion">
        <DotLottieReact
          src={require('../assets/animations/explosion.lottie')}
          loop={false}
          autoplay={true}
          speed={1.3}
          style={{
            width: 200,
            height: 200,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
    );
  }

  return (
    <div className="explosion-container">
      <div className="explosion-center">💥</div>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="explosion-particle"
          style={{
            '--vx': `${particle.vx}px`,
            '--vy': `${particle.vy}px`,
            fontSize: `${particle.size}px`
          } as React.CSSProperties}
        >
          {particle.emoji}
        </div>
      ))}
    </div>
  );
};

export default ExplosionEffect;