The game is called ElimiNinja.

It is 2D top-down taking place in a rectangular dojo.
The aim of the game is to survive as the ninja against shuriken bouncing around the dojo.
The user controls the ninja (simply a black circle holding a sword).

You move around by clicking with the mouse.
On click, the ninja moves from current position to the click point while swinging the sword. A very transparent circle is around the ninja which indicates the maximum distance he can swing. This transparent circle is gone when the ninja is moving but immediately reappears when he stops again.
Any shuriken in the ninjas path (the 180 direction the ninja faces during the swing, with the sword radius) falls to the ground and slowly disappears in 2s, adding to the total count.
If a shuriken hits the ninja while it is not moving, or from the back 180 degrees of the ninja while moving, the ninja dies and game ends, printing the final score of shurikens hit.

Shurikens come from off-screen and enter the dojo through the wall, and from then on, bounce off the inner walls of the dojo to stay inside it until the ninja swipes them.
All shurikens move at the same speed, but the rate of shurikens entering the dojo slowly increases as the ninja survives for a longer time.
The different shuriken types are the following.
White: normal shuriken, no special powers.
Green: homing shuriken, it's direction has a soft gravitational pull to the ninja always
Red: explosive shuriken, when sliced, instead of disappearing, it explodes after about 2s.
Black: when a black shuriken is inside the dojo for more than 5s, the field of view slowly decreases (i.e. a transparent circle centered on the ninja with black on its outside gets smaller and smaller until the ninja can't see anything and the whole screen is black). The current field of view is the minimum field of view for all black shurikens, and once all black shurikens are eliminated, the field of view immediately returns to normal (or if a black shuriken remains, it goes back to its new minimum).

Green shurikens start appearing after 30s, red shurikens after 60s, black shurikens after 90s. Frequency should be white > green > green > black.

There is a special power the ninja has which is zen mode, which slows down time. Sushis spawn randomly across the dojo, and if the ninja eats three sushis (visible in vertical power bar to right), the ninja will start glowing (additional sushis then do nothing). If the user taps the ninja itself, this activates zen mode. Everything slows down 90%, and the ninja can tap three spots in the screen (within 4s, or zen mode is cancelled). Then the ninja does repeated 360 degree spinning swings, going from current point to A to B to C killing all shurikens in the path. The ninja's power bar goes back to normal and play resumes at normal speed.
