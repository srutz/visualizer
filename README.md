# Visualizer (Visualizes PDFs as 3D books)

by stepan.rutz ([https://www.stepanrutz.com](https://www.stepanrutz.com)). Licensed under MIT. 

## Live demo

[https://srutz.github.io/visualizer/](https://srutz.github.io/visualizer/)

## Loading your own PDF

You can load a PDF in three ways:

- Drop a PDF file onto the window
- Click "Load your own PDF" in the header and pick a file
- Pass a `pdf` query parameter pointing at a PDF URL, e.g.
  [`?pdf=https://example.com/foo.pdf`](https://srutz.github.io/visualizer/?pdf=https://example.com/foo.pdf)

**Cross-origin note:** the `pdf` query parameter uses `fetch()`, so the
remote server must send permissive CORS headers
(`Access-Control-Allow-Origin: *` or the visualizer's origin). Without
them the browser blocks the request and the app shows a "Failed to
fetch" error. Same-origin URLs (anything served from the visualizer's
own domain) always work. And as a small tip, you don't want to allow ```*``` CORS on a real PDF-serving endpoint.

## Example PDFs

[https://srutz.github.io/visualizer/?proxypdf=https://github.com/progit/progit2/releases/download/2.1.449/progit.pdf](Pro Git book)
[https://tinyurl.com/47y84da6](BMF E-Rechnung (German e-invoicing standard))



## Techstack

... React + React Three Fiber + Vite and of course the React Compiler is enabled on this project.

## Made with LLMs and a few % manual coding 

Checkout 

[https://github.com/srutz/cagent](https://github.com/srutz/cagent) 

for the free opensource agent that helped me build this project.


