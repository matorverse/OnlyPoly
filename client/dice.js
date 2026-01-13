// Dice Animation & Logic Management (Ported from Richup)
(function () {
  const diceOverlay = document.getElementById('diceOverlay'); // This is the .dice-center-area in HTML

  // We expect HTML to have <div id="dice1"></div> <div id="dice2"></div> inside the container
  const dice1El = document.getElementById('dice1');
  const dice2El = document.getElementById('dice2');

  function buildCubeDOM(container) {
    if (!container) return null;

    // Clear existing
    container.innerHTML = '';

    // Structure:
    // .DiceContainer
    //   .DiceRoot
    //     .DiceCube
    //       Faces...

    const diceContainer = document.createElement('div');
    diceContainer.className = 'DiceContainer';

    // Shadow element is pseduo-element on DiceContainer in CSS, 
    // but the extracted CSS used :before on DiceContainer. 
    // So we don't need extra div for shadow if CSS handles it.

    const diceRoot = document.createElement('div');
    diceRoot.className = 'DiceRoot';
    diceContainer.appendChild(diceRoot);

    const diceCube = document.createElement('div');
    diceCube.className = 'DiceCube';
    diceRoot.appendChild(diceCube);

    // Create Faces 1-6
    for (let i = 1; i <= 6; i++) {
      const face = document.createElement('div');
      face.className = 'DiceFace';
      face.dataset.side = i;

      // Add dots based on side (CSS Grid handles positioning if we just add N dots)
      // Side 1: 1 dot
      // Side 2: 2 dots
      // Side 3: 3 dots
      // Side 4: 4 dots
      // Side 5: 5 dots
      // Side 6: 6 dots
      for (let d = 0; d < i; d++) {
        const dot = document.createElement('div');
        dot.className = 'DiceDot';
        face.appendChild(dot);
      }
      diceCube.appendChild(face);
    }

    // Create Inner Planes (Structure)
    const planeClasses = ['InnerPlane x-axis', 'InnerPlane y-axis', 'InnerPlane z-axis'];
    planeClasses.forEach(cls => {
      const plane = document.createElement('div');
      plane.className = cls;
      diceCube.appendChild(plane);
    });

    container.appendChild(diceContainer);
    return { container: diceContainer, cube: diceCube };
  }

  // State map
  const diceMap = new Map(); // Element -> { container, cube }

  function initDice(element) {
    if (!element) return;
    const objs = buildCubeDOM(element);
    diceMap.set(element, objs);
  }

  // Create initial structure
  initDice(dice1El);
  initDice(dice2El);

  // Rotation Logic
  // To show face N, we rotate cube by:
  // 1 (Back): X -180
  // 2 (Top?): X -90  ( CSS says face 2 is X 90. To bring it front, we need X -90 )
  // 3 (Right?): Y -90 ( CSS says face 3 is Y 90. To bring front, Y -90 )
  // 4 (Left?): Y 90   ( CSS says face 4 is -90. To bring front, Y 90 )
  // 5 (Bottom?): X 90 ( CSS says face 5 is -90. To bring front, X 90 )
  // 6 (Front): 0
  const targetRotations = {
    1: { x: -180, y: 0 },
    2: { x: -90, y: 0 },
    3: { x: 0, y: -90 },
    4: { x: 0, y: 90 },
    5: { x: 90, y: 0 },
    6: { x: 0, y: 0 }
  };

  let isRolling = false;
  let pendingDiceResult = null;
  const MIN_ROLL_TIME = 550; // Match 0.5s CSS transition + 100ms hang time

  window.isDiceAnimating = false;

  window.animateDiceRoll = function () {
    if (diceOverlay) diceOverlay.classList.add('visible');

    isRolling = true;
    window.isDiceAnimating = true; // Flag for external sync
    pendingDiceResult = null; // Clear previous pending

    diceMap.forEach(({ container, cube }) => {
      // "Throw" animation: Add DiceInstance class to container
      // This triggers the translateY up/down motion defined in CSS
      container.classList.remove('DiceInstance'); // reset

      // Use timeout to allow reset to frame
      setTimeout(() => {
        container.style.transition = 'transform 0.5s cubic-bezier(0.75, 0, 0.5, 1)';
        container.classList.add('DiceInstance');

        // Spin the cube wildly
        // We'll set a high rotation value
        const randX = 720 + Math.floor(Math.random() * 360);
        const randY = 720 + Math.floor(Math.random() * 360);
        cube.style.transition = 'transform 0.5s linear';
        cube.style.transform = `rotateX(${randX}deg) rotateY(${randY}deg)`;
      }, 10);
    });

    // Enforce minimum animation time
    setTimeout(() => {
      isRolling = false;
      if (pendingDiceResult) {
        // Result arrived while we were waiting, show it now
        // Note: We don't await this here as connection handles it, 
        // but strictly we should. However, the external caller (game.js)
        // will call showDiceResult again usually or we handle it here.
        // If pendingDiceResult is set, it means game.js called showDiceResult
        // which returned a promise that is waiting on 'isRolling' to flip.
        // Actually, let's keep it simple: if game.js called showDiceResult, 
        // it checked isRolling.
        
        // If we have pending result, we execute the "Landing" logic.
        // But showDiceResult needs to return the promise to the ORIGINAL caller.
        // The original caller is waiting on the promise returned when it called showDiceResult(val).
        // So we need to process that resolve logic.
        // We'll handle this by triggering the deferred function if we had one.
        if (pendingDiceResult.resolve) {
             doShowResult(pendingDiceResult.d1, pendingDiceResult.d2)
                 .then(pendingDiceResult.resolve);
        }
        pendingDiceResult = null;
      }
    }, MIN_ROLL_TIME);
  };

  function doShowResult(d1Value, d2Value) {
      return new Promise((resolve) => {
        if (diceOverlay) diceOverlay.classList.add('visible'); // Ensure visible
        const results = [{ el: dice1El, val: d1Value }, { el: dice2El, val: d2Value }];
    
        results.forEach(({ el, val }) => {
          const objs = diceMap.get(el);
          if (!objs) return;
          const { container, cube } = objs;
    
          // "Land" the dice
          container.classList.remove('DiceInstance');
    
          // Calculate final rotation
          const target = targetRotations[val] || { x: 0, y: 0 };
    
          // Richup CSS: .DiceCube { transition: 1s ... }
          cube.style.transition = 'transform 1s cubic-bezier(0, 0, 0, 1)'; // deceleration
          cube.style.transform = `rotateX(${target.x}deg) rotateY(${target.y}deg)`;
        });

        // Resolve after landing transition (1s)
        setTimeout(() => {
            window.isDiceAnimating = false;
            resolve();
        }, 1100); // 1s + buffer
      });
  }

  window.showDiceResult = function (d1Value, d2Value) {
    // If logic is still in "throw" phase, queue this result
    if (isRolling) {
      return new Promise((resolve) => {
          pendingDiceResult = { d1: d1Value, d2: d2Value, resolve };
      });
    }

    return doShowResult(d1Value, d2Value);
  };

  // Force visibility on load
  if (diceOverlay) diceOverlay.classList.add('visible');

})();
