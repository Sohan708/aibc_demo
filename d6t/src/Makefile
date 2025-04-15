CC = gcc
TARGET = ../bin/SensorDataApp
SRC = sensor.c logger.c
OBJS = ../obj/sensor.o ../obj/logger.o
CFLAGS = -Wall -Wextra

$(TARGET): $(OBJS)
	$(CC) $(OBJS) -o $(TARGET) $(LIBS)

../obj/%.o: %.c
	mkdir -p ../obj
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)
