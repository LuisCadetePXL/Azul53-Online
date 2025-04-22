using Azul.Core.TableAggregate.Contracts;
using System.ComponentModel;

namespace Azul.Core.TableAggregate
{
    /// <inheritdoc cref="ITablePreferences"/>
    public class TablePreferences : ITablePreferences
    {

        public TablePreferences()
        {
            NumberOfPlayers = 2;
            NumberOfArtificialPlayers = 0;
        }

        [DefaultValue(2)]
        public int NumberOfPlayers { get; set; }

        [DefaultValue(0)]
        public int NumberOfArtificialPlayers { get; set; }

        public int NumberOfFactoryDisplays
        {
            get
            {
                return 2 * NumberOfPlayers + 1;
            }
        }


        //DO NOT CHANGE THE CODE BELOW, unless (maybe) when you are working on EXTRA requirements
        public override bool Equals(object other)
        {
            if (other is ITablePreferences otherPreferences)
            {
                if (NumberOfPlayers != otherPreferences.NumberOfPlayers) return false;
                if (NumberOfArtificialPlayers != otherPreferences.NumberOfArtificialPlayers) return false;
            }
            return true;
        }

        public override int GetHashCode()
        {
            return NumberOfPlayers.GetHashCode();
        }
    }
}