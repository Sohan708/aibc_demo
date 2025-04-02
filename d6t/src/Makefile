CC = gcc
TARGET = ../bin/SensorDataApp
SRC = sensor.c
OBJ = ../obj/sensor.o

$(TARGET): $(OBJ)
	$(CC) $(OBJ) -o $(TARGET) $(LIBS)

$(OBJ): $(SRC)
	$(CC) -c $(SRC) -o $(OBJ)

clean:
	rm -f $(OBJ) $(TARGET)
