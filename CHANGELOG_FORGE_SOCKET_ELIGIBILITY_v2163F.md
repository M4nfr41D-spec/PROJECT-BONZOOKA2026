# Forge Socket Eligibility Fix v2163F

- Fixes forge eligibility so items with empty sockets are recognized for core recipes.
- Separates socket existence (`sockets`) from socket occupancy (`socket`).
- Prevents inserting a core into an occupied socket.
- Adds socket status text to selected forge target display.
