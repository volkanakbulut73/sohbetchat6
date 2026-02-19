import React from 'react';

const MusicPlayer: React.FC = () => {
  return (
    <div className="flex items-center h-10 md:h-12 overflow-hidden bg-black/40 rounded-lg border border-cyan-500/30 shadow-lg px-2 group">
      {/* 
        Iframe boyutu 345x65 olduğu için header içine sığması adına 
        scale (ölçeklendirme) kullanılarak optimize edildi.
      */}
      <div className="flex items-center justify-center transform scale-[0.75] md:scale-[0.85] origin-center -mx-10 md:-mx-4 transition-transform duration-300 group-hover:scale-[0.8] md:group-hover:scale-[0.9]">
        <iframe 
          width="345" 
          height="65" 
          src="https://www.radyod.com/iframe-small" 
          frameBorder="0" 
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
          title="Radyo D Canlı Yayın"
          className="rounded-md opacity-90 hover:opacity-100"
        ></iframe>
      </div>
    </div>
  );
};

export default MusicPlayer;