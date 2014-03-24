DailyEntity
===========

Up until Gawker's redesign, there was a pretty thriving community of tech geeks that hung out over at the #whitenoise tag on Gizmodo. When Gawker pushed out their re-design, DailyEntity launched as a customized WordPress site to take in all these misplaced users.

That worked for some time, but we constantly had server issues, always running out of resources thanks to the AJAX front-end we were using.

The "Solution"
---

When we were finally pushed into finding a new hosting service for DailyEntity, my goal was to re-make the site in Node.JS and be able to operate on a single Heroku Dyno. During a week, I developed the first iteration of DE and we moved. While this code was utilized to learn Node.JS, the platform is incredibly stable and has been running consistantly for over a year.

The front-end is completely realtime thanks to Now.JS (which was a mistake when I should have just used Socket.io). The backend uses Express for routing and Mustache for templating support (which is half-assed). It's BUILT around Heroku, but could be ported elsewhere.

The Quirks
---

I still consider this to be alpha code. There's still strange glitches with attachments (mostly), and it's probably insecure due to the trusted nature of the DailyEntity community. There's also zero pagination support still. The platform works for the most part, but comes completely undocumented. It requires a PostgreSQL database and Redis for session support.

License
---

    The MIT License (MIT)
    
    Copyright (c) 2014 Steve Rolfe
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
