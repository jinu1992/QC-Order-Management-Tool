import React from 'react';

interface LoadingCubeProps {
    size?: string;
    label?: string;
}

const LoadingCube: React.FC<LoadingCubeProps> = ({ size = "w-16 h-16", label }) => {
    // Standard Rubik's Cube Face Colors
    const cubeFaces = [
        { color: 'bg-red-500', transform: 'rotateY(0deg) translateZ(1.5rem)' },    // Front
        { color: 'bg-orange-500', transform: 'rotateY(180deg) translateZ(1.5rem)' }, // Back
        { color: 'bg-blue-600', transform: 'rotateY(90deg) translateZ(1.5rem)' },   // Right
        { color: 'bg-green-600', transform: 'rotateY(-90deg) translateZ(1.5rem)' },  // Left
        { color: 'bg-yellow-400', transform: 'rotateX(90deg) translateZ(1.5rem)' },   // Top
        { color: 'bg-white', transform: 'rotateX(-90deg) translateZ(1.5rem)' },      // Bottom
    ];

    return (
        <div className="flex flex-col items-center justify-center gap-6">
            <div className={`${size} perspective-1000 inline-block`}>
                <div 
                    className="relative w-12 h-12 transform-style-3d animate-cube-rotate mx-auto"
                >
                    {cubeFaces.map((face, fIdx) => (
                        <div 
                            key={fIdx}
                            className="absolute inset-0 bg-gray-900 grid grid-cols-3 grid-rows-3 gap-0.5 p-0.5 border border-black shadow-inner"
                            style={{ 
                                transform: face.transform,
                                width: '3rem',
                                height: '3rem'
                            }}
                        >
                            {[...Array(9)].map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`${face.color} rounded-[1px] animate-pulse`}
                                    style={{ 
                                        animationDelay: `${(fIdx * 9 + i) * 0.08}s`,
                                        animationDuration: '1.5s'
                                    }}
                                ></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {label && <p className="text-gray-500 font-bold tracking-tight animate-pulse">{label}</p>}
        </div>
    );
};

export default LoadingCube;