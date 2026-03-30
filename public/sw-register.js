if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(function () {
      console.log('SW registered');
    })
    .catch(function (err) {
      console.log('SW failed', err);
    });
}
