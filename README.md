DailyEntity
===========

Up until Gawker's redesign, there was a pretty thriving community of tech geeks that hung out over at the #whitenoise tag on Gizmodo. When Gawker pushed out their re-design, DailyEntity launched as a customized WordPress site to take in all these misplaced users.

That worked for some time, but we constantly had server issues, always running out of resources thanks to the AJAX front-end we were using.

The "Solution"
---

When we were finally pushed into finding a new hosting service for DailyEntity, my goal was to re-make the site in Node.JS and be able to operate on a single Heroku Dyno. During a week, I developed the first iteration of DE and we moved. While this code was utilized to learn Node.JS, the platform is incredibly stable and has been running consistantly for over a year.

The front-end is completely realtime thanks to Now.JS (which was a mistake when I should have just used Socket.io). The backend uses Express for routing.

The Quirks
---

I still consider this to be alpha code. There's still strange glitches with attachments (mostly), and it's probably insecure due to the trusted nature of the DailyEntity community. There's also zero pagination support still. The platform works for the most part, but comes completely undocumented. It requires a PostgreSQL database and Redis for session support.

License
---

Do whatever you want with it, but I provide no warranty or support. Don't sell it and don't claim it's yours, but I require no attribution.
