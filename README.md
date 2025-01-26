# UDBM - Realtime Database Monitor

<table>
<tr>
<td width="50%">

![Database Monitoring](readme_assets/ui.png)
</td>
<td width="50%">

![Database Schema](readme_assets/schema.png)
</td>
</tr>
</table>

A real-time web-based database monitoring system that you can use for multiple databases, free and locally. Monitor your MySQL and PostgreSQL databases with a modern, responsive interface.

## Features

- Real-time monitoring for MySQL and PostgreSQL databases, at any scale
- Interactive schema visualization with relationships
- Real-time data view with auto-refresh
- Pause/Resume monitoring, configurable refresh rate
- Light/dark mode, English/Korean language support
- Quick swipe to toggle tables
- Custom page title that sticks to each database
- Secure connection management with cookie-based persistence

## Future Plans

- Admin mode in settings menu for direct database operations:
  - Add, delete, and alter tables directly from the interface
  - Execute custom SQL queries
- Customization options:
  - Custom page logo placement next to page title
  - Custom favicon support
- Support for more SQL types besides MySQL and PostgreSQL

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd udbm
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. System dependencies (for Ubuntu/Debian):
```bash
sudo apt-get install graphviz graphviz-dev
```

For other systems, install GraphViz from [graphviz.org](https://graphviz.org/download/)

### (Optional) Testing with Sample Databases

- `python create_db.py`: Creates two sample databases (mock_db and fake_db) - one small and one large with predefined schemas. Use this if you want to quickly test the system without having any existing databases. Before running this, go to config.py to define your host, MySQL username, password.
- `python simulation.py`: Simulates three basic database operations (insert, update, delete) on the sample databases (if successes, the monitor page will have indicating animations like the below).

![Database Operations Animation](readme_assets/animation.png)

### Server Settings

The monitor server runs on port 5046 by default. To change this, modify the port number at the end of `monitor.py`

## Usage

1. Start the monitoring server:
```bash
python monitor.py
```

2. Access the web interface:
   - Open your browser and navigate to `http://localhost:5046`
   - Add your database connection through the interface

### Changing Page Title

Modified page title will be remembered to each of your DB separatedly

![Page Title Customization](readme_assets/title.png)

### Viewing Historical Data

Just scroll down, the monitoring will automatically pauses, it will auto resume when you scroll back up or collapse the table

![Historical Data View](readme_assets/tooltip.png)

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
