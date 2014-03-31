import sys
from PyQt4 import QtGui

class SysTrayIcon(QtGui.QSystemTrayIcon):

	def __init__(self, icon, parent=None, openInBrowserHandler=None, exitHandler=None):
		QtGui.QSystemTrayIcon.__init__(self, icon, parent)
		menu = QtGui.QMenu(parent)

		if openInBrowserHandler is not None:
			browserAction = menu.addAction("Open in browser")
			browserAction.triggered.connect(openInBrowserHandler)

		if exitHandler is not None:
			exitAction = menu.addAction("Exit")
			exitAction.triggered.connect(exitHandler)

		self.setContextMenu(menu)

def main():
	app = QtGui.QApplication(sys.argv)

	def exitHandler():
		app.quit()

	def openInBrowserHandler():
		import webbrowser
		webbrowser.open("http://localhost:5000/")

	# start everything
	w = QtGui.QWidget()
	trayIcon = SysTrayIcon(QtGui.QIcon("src/octoprint/static/img/tentacle-icon.xpm"), w, exitHandler=exitHandler, openInBrowserHandler=openInBrowserHandler)

	def runOctoPrint():
		from octoprint import Server
		from octoprint import events
		events.eventManager().subscribe(events.Events.CLIENT_OPENED, _clientOpened)
		events.eventManager().subscribe(events.Events.CLIENT_CLOSED, _clientClosed)

		octoprint = Server()
		octoprint.run()

	def _clientOpened(event, payload):
		trayIcon.showMessage("Client connected", "Client connected from %s" % payload["remoteAddress"])

	def _clientClosed(event, payload):
		trayIcon.showMessage("Client disconnected", "Client connection closed")

	import threading
	serverThread = threading.Thread(target=runOctoPrint, name="OctoPrint-Server")
	serverThread.daemon = True

	serverThread.start()

	trayIcon.show()
	sys.exit(app.exec_())

if __name__ == "__main__":
	main()
