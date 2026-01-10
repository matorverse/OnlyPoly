// Dice Animation & Logic Management (Richup 3D Style)
(function () {
  const diceOverlay = document.getElementById('diceOverlay');
  const dice1El = document.getElementById('dice1');
  const dice2El = document.getElementById('dice2');

  // Dot configurations for each value (1-6)
  const dotMap = {
    1: ['dot-center'],
    2: ['dot-tl', 'dot-br'],
    3: ['dot-tl', 'dot-center', 'dot-br'],
    4: ['dot-tl', 'dot-tr', 'dot-bl', 'dot-br'],
    5: ['dot-tl', 'dot-tr', 'dot-center', 'dot-bl', 'dot-br'],
    6: ['dot-tl', 'dot-tr', 'dot-ml', 'dot-mr', 'dot-bl', 'dot-br']
  };

  // Rotation map to show face (X, Y)
  const faceRotations = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: 90 },  // Face 2 is at -90, so rotate cube +90 to bring it front.
    3: { x: 90, y: 0 },  // Face 3 is at -90X, rotate cube +90X
    4: { x: -90, y: 0 }, // Face 4 is at 90X, rotate cube -90X
    5: { x: 0, y: -90 }, // Face 5 is at 90Y, rotate cube -90Y
    6: { x: 180, y: 0 }  // Face 6 is at 180Y.
  };

  function ensureCube(element) {
    if (!element) return null;
    let cube = element.querySelector('.richup-cube');
    if (!cube) {
      cube = document.createElement('div');
      cube.className = 'richup-cube';
      // Create 6 faces
      for (let i = 1; i <= 6; i++) {
        const face = document.createElement('div');
        face.className = `cube-face face-${i}`;
        // Add dots
        const dots = dotMap[i] || [];
        dots.forEach((pos) => {
          const d = document.createElement('div');
          d.className = `dice-dot ${pos}`;
          face.appendChild(d);
        });
        cube.appendChild(face);
      }
      element.innerHTML = '';
      element.appendChild(cube);
    }
    return cube;
  }

  // Helper to apply rotation
  function rotateCubeTo(cube, value) {
    const rot = faceRotations[value] || { x: 0, y: 0 };

    // Add random extra revolutions for "tumble" effect
    // e.g. add 2 full spins (720deg) to X and Y randomly
    // We keep the rotation accumulating so it doesn't snap back? 
    // Actually standard CSS transition handles specific degrees nicely if we just set a new high value.
    // But we need to ensure it lands on the specific face visual.
    // The logic: 360 * N + targetRot.

    const extraX = 360 * (2 + Math.floor(Math.random() * 2));
    const extraY = 360 * (2 + Math.floor(Math.random() * 2));

    const finalX = rot.x + extraX;
    const finalY = rot.y + extraY;

    cube.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;
  }

  // Start rolling animation
  window.animateDiceRoll = function () {
    if (!diceOverlay) return;
    diceOverlay.classList.add('visible'); // Show container if hidden (though we want it persistent now)

    [dice1El, dice2El].forEach(container => {
      const cube = ensureCube(container);
      if (cube) {
        cube.style.transition = 'none'; // reset transition for instant spin start
        // Reset transform to something neutral or keep previous?
        // To spin smoothly, we should probably start from 0 or current?
        // Resetting to 0 makes it jump if we don't handle it. 
        // For now, simple reset works for the "tumbling" animation class.
        cube.style.transform = 'rotateX(0deg) rotateY(0deg)';
        // Force reflow
        void cube.offsetWidth;
        cube.classList.add('rolling');
      }
    });
  };

  // Show final result
  window.showDiceResult = function (d1Value, d2Value) {
    if (!diceOverlay) return;

    const diceResults = [
      { el: dice1El, val: d1Value },
      { el: dice2El, val: d2Value }
    ];

    diceResults.forEach(({ el, val }) => {
      const cube = ensureCube(el);
      if (cube) {
        cube.classList.remove('rolling');
        // Re-enable transition for the landing
        cube.style.transition = 'transform 1.2s cubic-bezier(0.15, 0.9, 0.35, 1)';
        // Force reflow
        void cube.offsetWidth;
        rotateCubeTo(cube, val);
      }
    });

    // Disable auto-hiding to keep dice visible as per user request
    // diceOverlay.classList.remove('visible'); 
  };

  // Initialize cubes on load so they are visible immediately
  [dice1El, dice2El].forEach(ensureCube);
  // Also Make visible by default
  if (diceOverlay) diceOverlay.classList.add('visible');

})();
