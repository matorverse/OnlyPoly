// Dice Animation & Logic Management

(function () {
  const dice1 = document.getElementById('dice1');
  const dice2 = document.getElementById('dice2');

  function renderDice(diceElement, value) {
    if (!diceElement) return;

    // Reset transform to avoid accumulation issues (though we animate from scratch usually)
    // We want to force a reflow if we were already in this state, but for a fresh roll:

    // Mapping matches the CSS 3D transforms for the faces
    // Front: 1, Back: 6, Top: 2, Bottom: 5, Right: 3, Left: 4
    // Wait, let's verify standard dice opposites: 1-6, 2-5, 3-4.
    // CSS keys from user snippet:
    // 1: rotateX(0deg) rotateY(0deg)   -> Front
    // 6: rotateX(180deg) rotateY(0deg) -> Back
    // 2: rotateX(-90deg) rotateY(0deg) -> Bottom? Wait, user code said:
    //    case 2: rotateX(-90deg) ...
    //    .bottom { transform: rotateX(-90deg) ... } -> So 2 is Bottom.
    //    Standard dice: Top/Bottom are usually 2/5 or 3/4? 
    //    User code: 
    //      Top: rotateX(90deg) 
    //      Bottom: rotateX(-90deg)
    //    User JS for 2: rotateX(-90deg) -> Matches Bottom class.
    //    User JS for 5: rotateX(90deg) -> Matches Top class.
    //    Allows 2 and 5 to be opposite.
    //    User JS for 3: rotateX(0deg) rotateY(90deg) -> Right?
    //    .right { transform: rotateY(90deg) ... } -> Matches Right class.
    //    User JS for 4: rotateX(0deg) rotateY(-90deg) -> Left?
    //    .left { transform: rotateY(-90deg) ... } -> Matches Left class.

    // So the face mapping is:
    // 1: Front
    // 6: Back
    // 2: Bottom
    // 5: Top
    // 3: Right
    // 4: Left

    // Let's stick to the user's JS switch case exactly to match their CSS/Geom.

    let transform = '';
    switch (value) {
      case 1:
        transform = 'rotateX(0deg) rotateY(0deg)';
        break;
      case 6:
        transform = 'rotateX(180deg) rotateY(0deg)';
        break;
      case 2:
        transform = 'rotateX(90deg) rotateY(0deg)';
        break;
      case 5:
        transform = 'rotateX(-90deg) rotateY(0deg)';
        break;
      case 3:
        transform = 'rotateX(0deg) rotateY(-90deg)';
        break;
      case 4:
        transform = 'rotateX(0deg) rotateY(90deg)';
        break;
      default:
        transform = 'rotateX(0deg) rotateY(0deg)';
        break;
    }

    diceElement.style.transform = transform;
  }

  // Global function to trigger rolling animation
  // Server calls this via socket events implicitly by users clicking roll,
  // but we split "start animation" vs "show result".
  window.animateDiceRoll = function () {
    if (dice1) {
      dice1.style.animation = 'none';
      dice1.offsetHeight; /* trigger reflow */
      dice1.style.transform = ''; // Clear static transform to ensure animation starts from 0
      dice1.style.animation = 'rolling 1s linear infinite'; // Spin indefinitely until result comes
    }
    if (dice2) {
      dice2.style.animation = 'none';
      dice2.offsetHeight;
      dice2.style.transform = ''; // Clear static transform
      dice2.style.animation = 'rolling 1s linear infinite';
    }
  };

  // Global function to stop animation and show result
  window.showDiceResult = function (d1Value, d2Value) {
    if (dice1) {
      dice1.style.animation = 'none';
      renderDice(dice1, d1Value);
    }
    if (dice2) {
      dice2.style.animation = 'none';
      renderDice(dice2, d2Value);
    }
  };
})();
