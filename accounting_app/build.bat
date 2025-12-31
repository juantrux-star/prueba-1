@echo off
echo Compilando aplicacion contable...
python -m PyInstaller --name "ContabilidadDespacho" --add-data "templates;templates" --add-data "static;static" --onefile --noconsole app.py
echo.
echo Compilacion terminada. El ejecutable esta en la carpeta 'dist'.
pause
